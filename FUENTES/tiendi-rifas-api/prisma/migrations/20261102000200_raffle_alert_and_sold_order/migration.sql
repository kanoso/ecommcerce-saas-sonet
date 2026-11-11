-- A raffle-level alert, such as a blocked draw, has no order and no amount.
ALTER TABLE "OperatorAlert" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "OperatorAlert" ALTER COLUMN "amount" DROP NOT NULL;

-- The (type, orderId) unique keeps one alert per order; NULLs never collide,
-- so this keeps one alert per raffle and type when there is no order.
CREATE UNIQUE INDEX "OperatorAlert_type_raffleId_raffle_level_key"
  ON "OperatorAlert"("type", "raffleId") WHERE "orderId" IS NULL;

-- A SOLD ticket always has the order that bought it: the winner's email goes
-- to that buyer (DT-13). Stop here if any existing row breaks the rule.
DO $$
DECLARE
  offending TEXT;
BEGIN
  SELECT string_agg(id, ', ') INTO offending
  FROM "Ticket" WHERE status = 'SOLD' AND "orderId" IS NULL;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'SOLD tickets without an order: %. Resolve them by hand before migrating.', offending;
  END IF;
END $$;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sold_has_order"
  CHECK (status <> 'SOLD' OR "orderId" IS NOT NULL);

-- Deleting an order would set the ticket's order to NULL and break the rule
-- above; the order behind a ticket can no longer be deleted at all.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_orderId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
