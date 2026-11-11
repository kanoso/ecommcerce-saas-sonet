-- Allow direct in-person POS sales transition (AVAILABLE -> SOLD)
CREATE OR REPLACE FUNCTION check_ticket_transition()
RETURNS TRIGGER AS $$
DECLARE
  raffle_status TEXT;
BEGIN
  IF OLD.status = 'SOLD' AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW.number IS DISTINCT FROM OLD.number
    OR NEW."raffleId" IS DISTINCT FROM OLD."raffleId"
  ) THEN
    SELECT status INTO raffle_status FROM "Raffle" WHERE id = OLD."raffleId" FOR SHARE;
    IF raffle_status IN ('CLOSED', 'DRAWN') THEN
      RAISE EXCEPTION 'Frozen sold list: ticket % of a % raffle cannot change', OLD.id, raffle_status;
    END IF;
  END IF;

  IF NEW.status = OLD.status THEN
    IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
      RAISE EXCEPTION 'Invalid ticket transition: % ticket % cannot change order', OLD.status, OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('AVAILABLE', 'RESERVED'),
    ('AVAILABLE', 'SOLD'),
    ('RESERVED', 'SOLD'),
    ('RESERVED', 'AVAILABLE'),
    ('SOLD', 'REFUNDED')
  ) THEN
    RAISE EXCEPTION 'Invalid ticket transition: % -> % on ticket %', OLD.status, NEW.status, OLD.id;
  END IF;

  IF OLD.status IN ('RESERVED', 'SOLD')
     AND NEW.status IN ('SOLD', 'REFUNDED')
     AND NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    RAISE EXCEPTION 'Invalid ticket transition: % -> % must keep the order on ticket %', OLD.status, NEW.status, OLD.id;
  END IF;

  IF NEW.status = 'SOLD'
     AND (SELECT status FROM "Raffle" WHERE id = NEW."raffleId") <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Invalid ticket transition: ticket % cannot be sold on a raffle that is not ACTIVE', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
