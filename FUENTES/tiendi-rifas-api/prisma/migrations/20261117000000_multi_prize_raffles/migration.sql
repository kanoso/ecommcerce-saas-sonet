-- Multi-prize raffles: ordered prizes, winner exclusion mode frozen at the
-- close, per-prize draw results. Existing raffles and draws are backfilled as
-- single-prize (v1) data; nothing they publish changes.

-- CreateEnum
CREATE TYPE "WinnerExclusionMode" AS ENUM ('TICKET_ONLY', 'BUYER');

-- CreateEnum
CREATE TYPE "DrawWinnerStatus" AS ENUM ('WON', 'VOID');

-- AlterTable
ALTER TABLE "Raffle" ADD COLUMN     "drawConfigHash" TEXT,
ADD COLUMN     "winnerExclusionMode" "WinnerExclusionMode" NOT NULL DEFAULT 'TICKET_ONLY';

-- AlterTable
ALTER TABLE "Draw" ALTER COLUMN "digestHex" DROP NOT NULL,
ALTER COLUMN "winningTicketId" DROP NOT NULL,
ALTER COLUMN "winningNumber" DROP NOT NULL,
ALTER COLUMN "winnerIndex" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RafflePrize" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafflePrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawWinner" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "DrawWinnerStatus" NOT NULL,
    "ticketId" TEXT,
    "winningNumber" INTEGER,
    "winnerIndex" INTEGER,
    "digestHex" TEXT,
    "poolSize" INTEGER NOT NULL,
    "extractions" JSONB NOT NULL,
    "excludedTickets" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "DrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RafflePrize_raffleId_position_key" ON "RafflePrize"("raffleId", "position");

-- CreateIndex
CREATE INDEX "DrawWinner_ticketId_idx" ON "DrawWinner"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawWinner_drawId_position_key" ON "DrawWinner"("drawId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DrawWinner_drawId_ticketId_key" ON "DrawWinner"("drawId", "ticketId");

-- AddForeignKey
ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "RafflePrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill (backward compatibility)
-- ---------------------------------------------------------------------------

-- Every existing raffle gets its single prize at position 1. Raffle.prize,
-- prizeDescription and prizeImages stay as they are and keep mirroring it.
INSERT INTO "RafflePrize" ("id", "raffleId", "position", "title", "description", "images")
SELECT gen_random_uuid()::text, r."id", 1, r."prize", r."prizeDescription", r."prizeImages"
FROM "Raffle" r;

-- Every existing draw (all v1) gets its prize-1 result as a winner row. The
-- Draw columns are untouched, so v1 verification reads exactly what it did.
INSERT INTO "DrawWinner" (
  "id", "drawId", "prizeId", "position", "status", "ticketId", "winningNumber",
  "winnerIndex", "digestHex", "poolSize", "extractions", "excludedTickets"
)
SELECT
  gen_random_uuid()::text, d."id", p."id", 1, 'WON', d."winningTicketId", d."winningNumber",
  d."winnerIndex", d."digestHex", d."totalSold", COALESCE(d."extractions", '[]'::jsonb),
  ARRAY[d."winningNumber"]
FROM "Draw" d
JOIN "RafflePrize" p ON p."raffleId" = d."raffleId" AND p."position" = 1;

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- The winner exclusion mode is fixed once sales close, and the draw
-- configuration hash is written once, by the close itself (ACTIVE -> CLOSED),
-- before the drand round exists. Neither changes afterwards.
CREATE OR REPLACE FUNCTION check_raffle_draw_config_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status NOT IN ('DRAFT', 'ACTIVE')
     AND NEW."winnerExclusionMode" IS DISTINCT FROM OLD."winnerExclusionMode" THEN
    RAISE EXCEPTION 'Raffle_exclusion_mode_locked: winnerExclusionMode cannot change once the raffle is %', OLD.status;
  END IF;

  IF NEW."drawConfigHash" IS DISTINCT FROM OLD."drawConfigHash"
     AND NOT (OLD."drawConfigHash" IS NULL AND OLD.status = 'ACTIVE' AND NEW.status = 'CLOSED') THEN
    RAISE EXCEPTION 'Raffle_draw_config_frozen: drawConfigHash is set only once, when sales close';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raffle_draw_config_immutable ON "Raffle";
CREATE TRIGGER trg_raffle_draw_config_immutable
BEFORE UPDATE ON "Raffle"
FOR EACH ROW
EXECUTE FUNCTION check_raffle_draw_config_immutability();

-- Prizes change only while their raffle is a DRAFT. A raffle already gone
-- (the cascade of a deleted draft) does not block the delete.
CREATE OR REPLACE FUNCTION check_raffle_prize_draft_only()
RETURNS TRIGGER AS $$
DECLARE
  raffle_status TEXT;
BEGIN
  SELECT status INTO raffle_status
  FROM "Raffle"
  WHERE id = COALESCE(NEW."raffleId", OLD."raffleId");

  IF raffle_status IS NOT NULL AND raffle_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'RafflePrize_draft_only: prizes of a % raffle cannot change', raffle_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raffle_prize_draft_only ON "RafflePrize";
CREATE TRIGGER trg_raffle_prize_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "RafflePrize"
FOR EACH ROW
EXECUTE FUNCTION check_raffle_prize_draft_only();

-- A drawn result is never rewritten.
CREATE OR REPLACE FUNCTION check_draw_winner_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DrawWinner records are append-only: % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_draw_winner_append_only ON "DrawWinner";
CREATE TRIGGER trg_draw_winner_append_only
BEFORE UPDATE OR DELETE ON "DrawWinner"
FOR EACH ROW
EXECUTE FUNCTION check_draw_winner_append_only();
