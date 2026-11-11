-- DT-17: the operator who completes a refund is not the one who recorded the
-- money it returns. CompleteRefund checks it first and audits a refusal; these
-- rules hold it for any other write. The recorder is the "verifiedBy" of the
-- Payment named by the refund, or else of the one money Payment of the order
-- (APPROVED, REJECTED_RECEIVED or LATE_CONFIRMED). Refund."operatorId" is the
-- operator who completes it.
--
-- Operator ids are auth subject ids in canonical form: lowercase letters,
-- digits and . _ @ -, 1 to 128 of them. The application trims and lowercases
-- them at the source, and compares canonical ids by equality, as here.
--
-- These guards stop application bugs and accidental writes. They do not stop
-- a database superuser, who can drop them: restrict database credentials.

CREATE OR REPLACE FUNCTION is_operator_id(id TEXT)
RETURNS BOOLEAN AS $$
  SELECT coalesce(id ~ '^[a-z0-9._@-]{1,128}$', false);
$$ LANGUAGE sql IMMUTABLE;

-- Existing data must already follow the rules, or the migration stops.
DO $$
DECLARE
  offending TEXT;
BEGIN
  SELECT string_agg(p.id, ', ') INTO offending
  FROM "Payment" AS p
  WHERE p.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED', 'EXTRA_RECEIVED')
    AND (jsonb_typeof(p.payload->'verifiedBy') IS DISTINCT FROM 'string'
         OR NOT is_operator_id(p.payload->>'verifiedBy'));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Money payments without a canonical operator: %. Resolve them by hand before migrating.', offending;
  END IF;

  SELECT string_agg(o."orderId", ', ') INTO offending
  FROM (
    SELECT "orderId" FROM "Payment"
    WHERE status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED')
    GROUP BY "orderId" HAVING count(*) > 1
  ) AS o;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Orders with more than one money payment: %. Resolve them by hand before migrating.', offending;
  END IF;

  SELECT string_agg(r.id, ', ') INTO offending
  FROM "Refund" AS r
  LEFT JOIN "Payment" AS p ON p.id = r."paymentId"
  WHERE r."paymentId" IS NOT NULL
    AND (p.id IS NULL OR p.status <> 'EXTRA_RECEIVED' OR p."orderId" <> r."orderId");
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Refunds naming a payment that is not an extra transfer of their order: %. Resolve them by hand before migrating.', offending;
  END IF;

  SELECT string_agg(r.id, ', ') INTO offending
  FROM "Refund" AS r
  WHERE r.status = 'PENDING'
    AND NOT EXISTS (
      SELECT 1 FROM "Payment" AS p
      WHERE is_operator_id(p.payload->>'verifiedBy')
        AND (
          (r."paymentId" IS NOT NULL AND p.id = r."paymentId")
          OR (r."paymentId" IS NULL AND p."orderId" = r."orderId"
              AND p.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED'))
        )
    );
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Pending refunds whose recorder cannot be resolved: %. Resolve them by hand before migrating.', offending;
  END IF;
END $$;

-- 1. One money payment of its own per order. Extra transfers stay many (DT-16).
CREATE UNIQUE INDEX "Payment_order_money_key" ON "Payment"("orderId")
  WHERE status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED');

-- 2. Every money payment names its operator as a canonical id string.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_money_has_operator" CHECK (
  status NOT IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED', 'EXTRA_RECEIVED')
  OR (jsonb_typeof(payload->'verifiedBy') = 'string'
      AND is_operator_id(payload->>'verifiedBy'))
);

-- 3. A money payment is born as one and never changes: no code updates a
-- payment, and its status, order and operator are what the four-eyes control
-- reads. The whole payload is frozen, because nothing writes to it later.
CREATE OR REPLACE FUNCTION check_payment_money_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED', 'EXTRA_RECEIVED')
     AND (NEW.status IS DISTINCT FROM OLD.status
          OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
          OR NEW.payload IS DISTINCT FROM OLD.payload) THEN
    RAISE EXCEPTION 'Payment_money_immutable: payment % cannot change its status, order or payload', OLD.id;
  END IF;
  IF NEW.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED', 'EXTRA_RECEIVED')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Payment_money_immutable: payment % cannot become money after it was recorded', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_money_immutable ON "Payment";
CREATE TRIGGER trg_payment_money_immutable
BEFORE UPDATE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION check_payment_money_immutable();

-- 4. A money payment is never deleted, even through its order.
CREATE OR REPLACE FUNCTION check_payment_money_kept()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED', 'EXTRA_RECEIVED') THEN
    RAISE EXCEPTION 'Payment_money_kept: payment % records money and cannot be deleted', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_money_kept ON "Payment";
CREATE TRIGGER trg_payment_money_kept
BEFORE DELETE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION check_payment_money_kept();

-- 5. A completed refund stays as it was completed, and stays.
CREATE OR REPLACE FUNCTION check_refund_completed_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'COMPLETED' THEN
      RAISE EXCEPTION 'Refund_completed_immutable: refund % was completed and cannot be deleted', OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'COMPLETED' AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'Refund_completed_immutable: refund % was completed and cannot change', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refund_completed_immutable ON "Refund";
CREATE TRIGGER trg_refund_completed_immutable
BEFORE UPDATE OR DELETE ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION check_refund_completed_immutable();

-- 6. No one empties the money records in one statement.
CREATE OR REPLACE FUNCTION refuse_money_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Money_records_kept: % cannot be truncated', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_no_truncate ON "Payment";
CREATE TRIGGER trg_payment_no_truncate
BEFORE TRUNCATE ON "Payment"
FOR EACH STATEMENT
EXECUTE FUNCTION refuse_money_truncate();

DROP TRIGGER IF EXISTS trg_refund_no_truncate ON "Refund";
CREATE TRIGGER trg_refund_no_truncate
BEFORE TRUNCATE ON "Refund"
FOR EACH STATEMENT
EXECUTE FUNCTION refuse_money_truncate();

-- 7. A refund names only an extra transfer of its own order (DT-16). This
-- replaces the function of 20261102000400, which checked the order only.
CREATE OR REPLACE FUNCTION check_refund_payment_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."paymentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Payment"
    WHERE id = NEW."paymentId" AND "orderId" = NEW."orderId"
      AND status = 'EXTRA_RECEIVED'
  ) THEN
    RAISE EXCEPTION 'Refund_payment_order_mismatch: refund % names payment % that is not an extra transfer of its order', NEW.id, NEW."paymentId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Completing a refund, by update or by inserting it completed, needs a
-- canonical operator other than its recorder. Existing COMPLETED refunds are
-- not checked.
CREATE OR REPLACE FUNCTION check_refund_four_eyes()
RETURNS TRIGGER AS $$
DECLARE
  recorders TEXT[];
BEGIN
  IF NEW.status <> 'COMPLETED'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED') THEN
    RETURN NEW;
  END IF;

  IF NOT is_operator_id(NEW."operatorId") THEN
    RAISE EXCEPTION 'Refund_operator_invalid: refund % is completed without a canonical operator', NEW.id;
  END IF;

  IF NEW."paymentId" IS NOT NULL THEN
    SELECT array_agg(p.payload->>'verifiedBy') INTO recorders
    FROM "Payment" AS p
    WHERE p.id = NEW."paymentId";
  ELSE
    SELECT array_agg(p.payload->>'verifiedBy') INTO recorders
    FROM "Payment" AS p
    WHERE p."orderId" = NEW."orderId"
      AND p.status IN ('APPROVED', 'REJECTED_RECEIVED', 'LATE_CONFIRMED');
  END IF;

  IF recorders IS NULL OR cardinality(recorders) <> 1
     OR NOT is_operator_id(recorders[1]) THEN
    RAISE EXCEPTION 'Refund_recorder_unknown: refund % has no payment with a recorded operator', NEW.id;
  END IF;
  IF recorders[1] = NEW."operatorId" THEN
    RAISE EXCEPTION 'Refund_same_operator: refund % returns money that % recorded', NEW.id, NEW."operatorId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refund_four_eyes ON "Refund";
CREATE TRIGGER trg_refund_four_eyes
BEFORE INSERT OR UPDATE OF status ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION check_refund_four_eyes();
