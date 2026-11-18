-- Exits of a CLOSED raffle (DT-15, DT-21).
--
-- Until now no trigger guarded the status of a Raffle: CLOSED -> CANCELLED
-- (the cancel of an altered sold list, DT-15) was allowed like any other
-- change, and only the application's StaleStateError guard and the domain
-- transitions kept a closed raffle from moving back. A raffle whose v2 draw
-- was refused for its configuration (DT-21) leaves CLOSED the same way, so
-- this guard is the first to name the exits of a CLOSED raffle:
--   * CLOSED -> DRAWN: the draw.
--   * CLOSED -> CANCELLED: only with a reason. Both operator cancels (an
--     altered list and a refused draw) write the operator's reason in the
--     same UPDATE; a bare status change from outside the application cannot
--     cancel a raffle whose buyers' money is at stake.
--   * Anything else (back to ACTIVE or DRAFT) is refused: the sold list,
--     the seed and the draw configuration were frozen at the close.
-- Every other trigger stays as it is: the cancel changes neither the
-- frozen configuration (trg_raffle_draw_config_immutable) nor the schedule,
-- and it saves the raffle as CANCELLED before any hold is freed, so the
-- ticket guards no longer see a CLOSED raffle.
CREATE OR REPLACE FUNCTION check_raffle_closed_exit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'CLOSED' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'CANCELLED' THEN
      IF NEW."cancellationReason" IS NULL OR btrim(NEW."cancellationReason") = '' THEN
        RAISE EXCEPTION 'Raffle_closed_exit: a CLOSED raffle % is cancelled only with a reason', OLD.id;
      END IF;
    ELSIF NEW.status <> 'DRAWN' THEN
      RAISE EXCEPTION 'Raffle_closed_exit: a CLOSED raffle % cannot move to %', OLD.id, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raffle_closed_exit ON "Raffle";
CREATE TRIGGER trg_raffle_closed_exit
BEFORE UPDATE ON "Raffle"
FOR EACH ROW
EXECUTE FUNCTION check_raffle_closed_exit();
