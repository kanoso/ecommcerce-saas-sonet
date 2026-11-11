-- Invariant: a ticket only follows the lifecycle in spec section 8.1, so no
-- writer can sell a number twice, even one that skips the application locks.
CREATE OR REPLACE FUNCTION check_ticket_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
      RAISE EXCEPTION 'Invalid ticket transition: % ticket % cannot change order', OLD.status, OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('AVAILABLE', 'RESERVED'),
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_transition
BEFORE UPDATE ON "Ticket"
FOR EACH ROW
EXECUTE FUNCTION check_ticket_transition();
