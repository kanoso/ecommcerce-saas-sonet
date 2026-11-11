-- F5: the close of sales and the draw time are fixed once the raffle leaves
-- DRAFT. The close job is scheduled at salesCloseAt, and the drand round was
-- chosen after it: moving either would break both.
CREATE OR REPLACE FUNCTION check_raffle_schedule_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND (
       NEW."salesCloseAt" IS DISTINCT FROM OLD."salesCloseAt" OR
       NEW."drawAt" IS DISTINCT FROM OLD."drawAt") THEN
    RAISE EXCEPTION 'Raffle_schedule_immutable: salesCloseAt and drawAt cannot change once the raffle is not in DRAFT status';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raffle_schedule_immutable ON "Raffle";
CREATE TRIGGER trg_raffle_schedule_immutable
BEFORE UPDATE ON "Raffle"
FOR EACH ROW
EXECUTE FUNCTION check_raffle_schedule_immutability();
