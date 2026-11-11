-- DT-16: the refund of an extra transfer belongs to the order of its Payment.
-- A trigger rather than a composite foreign key: Prisma cannot model
-- (paymentId, orderId) -> Payment(id, orderId) next to the required orderId
-- relation without drift, and the other invariants are triggers too.

-- Existing rows must already agree, or the migration stops.
DO $$
DECLARE
  offending TEXT;
BEGIN
  SELECT string_agg(r.id, ', ') INTO offending
  FROM "Refund" AS r
  JOIN "Payment" AS p ON p.id = r."paymentId"
  WHERE p."orderId" <> r."orderId";
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Refunds linked to a payment of another order: %. Resolve them by hand before migrating.', offending;
  END IF;
END $$;

-- 1. A refund names a payment of its own order.
CREATE OR REPLACE FUNCTION check_refund_payment_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."paymentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Payment"
    WHERE id = NEW."paymentId" AND "orderId" = NEW."orderId"
  ) THEN
    RAISE EXCEPTION 'Refund_payment_order_mismatch: refund % names payment % of another order', NEW.id, NEW."paymentId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refund_payment_order ON "Refund";
CREATE TRIGGER trg_refund_payment_order
BEFORE INSERT OR UPDATE OF "paymentId", "orderId" ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION check_refund_payment_order();

-- 2. A payment behind a refund cannot move to another order.
CREATE OR REPLACE FUNCTION check_payment_refund_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId" AND EXISTS (
    SELECT 1 FROM "Refund" WHERE "paymentId" = OLD.id
  ) THEN
    RAISE EXCEPTION 'Refund_payment_order_mismatch: payment % backs a refund of order %', OLD.id, OLD."orderId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_refund_order ON "Payment";
CREATE TRIGGER trg_payment_refund_order
BEFORE UPDATE OF "orderId" ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION check_payment_refund_order();
