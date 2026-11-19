-- Live draw session of a MANUAL raffle (DT-23).
--
-- The official draw is recorded FIRST (the Draw row and its DrawWinner rows,
-- both append-only); this row only paces WHEN each step of that recorded
-- result is shown to the public. It cannot change WHAT was drawn: it holds
-- no number, only a counter.
--   * step: how many steps are revealed, from 0 (started, nothing shown) to
--     totalSteps (everything shown). One step is one extraction (attempt) of
--     a won prize, or the reveal of a void prize, in prize order.
--   * finishedAt: set once, when the last step is reached or the operator
--     reveals everything; the session never moves again.
CREATE TABLE "LiveDrawSession" (
    "raffleId" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LiveDrawSession_pkey" PRIMARY KEY ("raffleId"),
    CONSTRAINT "LiveDrawSession_totalSteps_positive" CHECK ("totalSteps" >= 1),
    CONSTRAINT "LiveDrawSession_step_bounded" CHECK ("step" >= 0 AND "step" <= "totalSteps"),
    CONSTRAINT "LiveDrawSession_finished_at_end" CHECK ("finishedAt" IS NULL OR "step" = "totalSteps")
);

CREATE UNIQUE INDEX "LiveDrawSession_drawId_key" ON "LiveDrawSession"("drawId");

ALTER TABLE "LiveDrawSession" ADD CONSTRAINT "LiveDrawSession_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LiveDrawSession" ADD CONSTRAINT "LiveDrawSession_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The step only moves forward, the bound and the draw never change, and a
-- finished session is frozen. The application advances with a conditional
-- UPDATE on the expected step; this guard catches any other writer.
CREATE OR REPLACE FUNCTION check_live_draw_session_forward()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."finishedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'LiveDrawSession_finished: the live draw of raffle % already finished', OLD."raffleId";
  END IF;
  IF NEW."step" < OLD."step" THEN
    RAISE EXCEPTION 'LiveDrawSession_backwards: the live draw of raffle % cannot go back from step % to %', OLD."raffleId", OLD."step", NEW."step";
  END IF;
  IF NEW."drawId" IS DISTINCT FROM OLD."drawId"
     OR NEW."totalSteps" IS DISTINCT FROM OLD."totalSteps"
     OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt" THEN
    RAISE EXCEPTION 'LiveDrawSession_immutable: the draw, bound and start of raffle % are fixed', OLD."raffleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_live_draw_session_forward ON "LiveDrawSession";
CREATE TRIGGER trg_live_draw_session_forward
BEFORE UPDATE ON "LiveDrawSession"
FOR EACH ROW
EXECUTE FUNCTION check_live_draw_session_forward();
