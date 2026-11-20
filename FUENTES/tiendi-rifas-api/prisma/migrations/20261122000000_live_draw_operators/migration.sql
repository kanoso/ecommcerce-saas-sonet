-- Who ran a live draw (DT-23): the public page names the admin who
-- conducted the session and who executed the official draw.
--   * Draw.executedBy: the operator (User id) who triggered the draw, from
--     POST /admin/rifas/:id/sorteo or en-vivo/iniciar; NULL otherwise.
--   * Draw.executedByKind: ADMIN (with executedBy) or SYSTEM (the draw job).
--     Draws stored before this column keep NULL in both: they name no
--     executor, never a guessed one (a MANUAL draw run live by an admin
--     must not read as automatic).
--   * LiveDrawSession.startedBy: the operator who started the session; NULL
--     for sessions stored before this column (they name nobody).
--   * LiveDrawSession.finishedBy: the operator whose action ended it.
-- The ids are never exposed publicly: only the account's display name is.
-- No foreign key, like the operator ids of the audit log (DT-17).
ALTER TABLE "Draw" ADD COLUMN "executedBy" TEXT,
ADD COLUMN "executedByKind" TEXT;

ALTER TABLE "Draw" ADD CONSTRAINT "Draw_executedBy_kind" CHECK (
  ("executedByKind" IS NULL AND "executedBy" IS NULL)
  OR ("executedByKind" = 'SYSTEM' AND "executedBy" IS NULL)
  OR ("executedByKind" = 'ADMIN' AND "executedBy" IS NOT NULL)
);

ALTER TABLE "LiveDrawSession" ADD COLUMN "startedBy" TEXT,
ADD COLUMN "finishedBy" TEXT;

-- Same guard as before, plus: the starter is fixed like the start.
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
     OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
     OR NEW."startedBy" IS DISTINCT FROM OLD."startedBy" THEN
    RAISE EXCEPTION 'LiveDrawSession_immutable: the draw, bound and start of raffle % are fixed', OLD."raffleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
