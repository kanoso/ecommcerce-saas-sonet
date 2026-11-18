-- Follow-up guards for multi-prize raffles (20261117000000_multi_prize_raffles
-- is already applied and stays untouched):
-- 1. Raffle.drawConfigFrozenAt: when drawConfigHash was frozen. A v2 draw
--    refuses a configuration frozen at or after its drand round's publication.
-- 2. The winner exclusion mode is locked from salesCloseAt on, even before the
--    close job runs, and cannot change in the UPDATE that closes the sales.
-- 3. A prize cannot be moved out of a raffle that is no longer a DRAFT.
-- 4. Once sales are closed, the buyer of an order and the order of a ticket
--    are fixed: both feed the buyer groups hashed into drawConfigHash.

-- AlterTable
ALTER TABLE "Raffle" ADD COLUMN "drawConfigFrozenAt" TIMESTAMP(3);

-- Backfill: closes made before this column existed froze the configuration in
-- the same transaction as their SALES_CLOSED audit event (append-only).
UPDATE "Raffle" r
SET "drawConfigFrozenAt" = e."closedAt"
FROM (
  SELECT "raffleId", MIN("occurredAt") AS "closedAt"
  FROM "AuditEvent"
  WHERE type = 'SALES_CLOSED'
  GROUP BY "raffleId"
) e
WHERE e."raffleId" = r.id
  AND r."drawConfigHash" IS NOT NULL
  AND r."drawConfigFrozenAt" IS NULL;

-- ---------------------------------------------------------------------------
-- Raffle: exclusion mode, configuration hash and its freeze time
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_raffle_draw_config_immutability()
RETURNS TRIGGER AS $$
DECLARE
  closing BOOLEAN := OLD.status = 'ACTIVE' AND NEW.status = 'CLOSED';
BEGIN
  IF NEW."winnerExclusionMode" IS DISTINCT FROM OLD."winnerExclusionMode" THEN
    -- Neither after the close nor in the UPDATE that performs it.
    IF OLD.status NOT IN ('DRAFT', 'ACTIVE') OR NEW.status NOT IN ('DRAFT', 'ACTIVE') THEN
      RAISE EXCEPTION 'Raffle_exclusion_mode_locked: winnerExclusionMode cannot change once the raffle is % (moving to %)', OLD.status, NEW.status;
    END IF;
    -- The close of sales arrived: the close job may simply not have run yet.
    -- Prisma keeps DateTime as UTC in timestamp(3) columns.
    IF OLD.status = 'ACTIVE' AND OLD."salesCloseAt" IS NOT NULL
       AND (now() AT TIME ZONE 'UTC') >= OLD."salesCloseAt" THEN
      RAISE EXCEPTION 'Raffle_exclusion_mode_locked: winnerExclusionMode cannot change after salesCloseAt (%)', OLD."salesCloseAt";
    END IF;
  END IF;

  IF NEW."drawConfigHash" IS DISTINCT FROM OLD."drawConfigHash"
     AND NOT (OLD."drawConfigHash" IS NULL AND closing) THEN
    RAISE EXCEPTION 'Raffle_draw_config_frozen: drawConfigHash is set only once, when sales close';
  END IF;

  IF NEW."drawConfigFrozenAt" IS DISTINCT FROM OLD."drawConfigFrozenAt"
     AND NOT (OLD."drawConfigFrozenAt" IS NULL AND closing AND NEW."drawConfigHash" IS NOT NULL) THEN
    RAISE EXCEPTION 'Raffle_draw_config_frozen: drawConfigFrozenAt is set only once, with drawConfigHash, when sales close';
  END IF;

  -- The close that freezes the hash records when it did, never earlier than
  -- the database's own clock: an application clock running behind cannot
  -- make a late freeze look early.
  IF OLD."drawConfigHash" IS NULL AND NEW."drawConfigHash" IS NOT NULL AND closing THEN
    NEW."drawConfigFrozenAt" := GREATEST(
      COALESCE(NEW."drawConfigFrozenAt", (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)),
      (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (The trigger trg_raffle_draw_config_immutable already calls this function.)

-- ---------------------------------------------------------------------------
-- RafflePrize: writable only while its raffle, before and after, is a DRAFT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_raffle_prize_draft_only()
RETURNS TRIGGER AS $$
DECLARE
  raffle_status TEXT;
BEGIN
  -- The raffle the row leaves (UPDATE, DELETE). A raffle already gone (the
  -- cascade of a deleted draft) does not block the delete.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status INTO raffle_status FROM "Raffle" WHERE id = OLD."raffleId";
    IF raffle_status IS NOT NULL AND raffle_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'RafflePrize_draft_only: prizes of a % raffle cannot change', raffle_status;
    END IF;
  END IF;

  -- The raffle the row lands in (INSERT, UPDATE).
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status INTO raffle_status FROM "Raffle" WHERE id = NEW."raffleId";
    IF raffle_status IS NOT NULL AND raffle_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'RafflePrize_draft_only: prizes of a % raffle cannot change', raffle_status;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Buyers are fixed once sales close
-- ---------------------------------------------------------------------------

-- The buyer of an order groups its tickets in BUYER mode. Nothing in the
-- application changes it; a write from outside after the close would make the
-- frozen drawConfigHash unreachable for good.
CREATE OR REPLACE FUNCTION check_ticket_order_buyer_frozen()
RETURNS TRIGGER AS $$
DECLARE
  raffle_status TEXT;
BEGIN
  IF NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    SELECT status INTO raffle_status FROM "Raffle" WHERE id = OLD."raffleId";
    IF raffle_status IN ('CLOSED', 'DRAWN') THEN
      RAISE EXCEPTION 'TicketOrder_buyer_frozen: the buyer of order % of a % raffle cannot change', OLD.id, raffle_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_order_buyer_frozen ON "TicketOrder";
CREATE TRIGGER trg_ticket_order_buyer_frozen
BEFORE UPDATE ON "TicketOrder"
FOR EACH ROW
EXECUTE FUNCTION check_ticket_order_buyer_frozen();

-- The order of a ticket names its buyer. trg_ticket_transition already
-- freezes SOLD tickets of CLOSED and DRAWN raffles; this covers every ticket:
-- once sales close no ticket gains an order or moves to another one, and a
-- SOLD ticket never loses its order. Releasing a hold (orderId -> NULL on a
-- ticket that is not SOLD) stays allowed: it names no buyer, and the sold list
-- and buyer groups come from SOLD tickets only. The close frees every hold
-- while the raffle row is still ACTIVE; a hold left by a writer that skipped
-- the application is freed by the cancel of the altered raffle (DT-15). Named
-- to run after trg_ticket_transition, whose messages stay the first ones raised.
CREATE OR REPLACE FUNCTION check_ticket_order_frozen()
RETURNS TRIGGER AS $$
DECLARE
  raffle_status TEXT;
BEGIN
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId"
     AND (NEW."orderId" IS NOT NULL OR OLD.status = 'SOLD') THEN
    SELECT status INTO raffle_status FROM "Raffle" WHERE id = OLD."raffleId";
    IF raffle_status IN ('CLOSED', 'DRAWN') THEN
      RAISE EXCEPTION 'Ticket_order_frozen: the order of ticket % of a % raffle cannot change', OLD.id, raffle_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_transition_order_frozen ON "Ticket";
CREATE TRIGGER trg_ticket_transition_order_frozen
BEFORE UPDATE ON "Ticket"
FOR EACH ROW
EXECUTE FUNCTION check_ticket_order_frozen();
