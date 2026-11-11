-- An operation number identifies money in a bank, whatever the method the buyer
-- named, and it is stored in one canonical form (DT-12).

-- Same rule as normalizeOperationNumber: whitespace, dashes and invisible format
-- characters go, in that order of the three lines below. They are listed by code
-- point and compared under the C collation, so the result does not depend on the
-- locale of the database. A character missing from this list is refused below,
-- so a difference with the application stops the migration, never slips through.
-- Returns NULL for a number that does not conform.
CREATE FUNCTION pg_temp.canonical_operation_number(raw TEXT) RETURNS TEXT AS $$
DECLARE
  stripped TEXT;
BEGIN
  stripped := regexp_replace(
    normalize(raw, NFKC) COLLATE "C",
    '[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF'
    '\u002D\u058A\u05BE\u1400\u1806\u2010-\u2015\u2212\u2E17\u2E1A\u2E3A\u2E3B\u2E40\u2E5D\u301C\u3030\u30A0\uFE31\uFE32\uFE58\uFE63\uFF0D'
    '\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFFF9-\uFFFB]+',
    '',
    'g'
  );
  IF stripped COLLATE "C" !~ '^[A-Za-z0-9]+$' THEN
    RETURN NULL;
  END IF;
  RETURN upper(stripped COLLATE "C");
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Two payments that turn out to be one operation, or a number no rule can read,
-- need a person: choosing here would silently change what was recorded.
DO $$
DECLARE
  offending TEXT;
BEGIN
  SELECT string_agg(quote_literal("externalId"), ', ' ORDER BY "externalId")
  INTO offending
  FROM "Payment"
  WHERE pg_temp.canonical_operation_number("externalId") IS NULL;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Payment operation numbers do not conform to letters and digits: %. Resolve them by hand before migrating.', offending;
  END IF;

  SELECT string_agg(canonical, ', ' ORDER BY canonical)
  INTO offending
  FROM (
    SELECT pg_temp.canonical_operation_number("externalId") AS canonical
    FROM "Payment"
    GROUP BY 1
    HAVING count(*) > 1
  ) AS repeated;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'Payment operation numbers collide once normalized: %. Resolve them by hand before migrating.', offending;
  END IF;
END $$;

UPDATE "TicketOrder" AS o
SET "operationNumber" = pg_temp.canonical_operation_number(p."externalId")
FROM "Payment" AS p
WHERE p."orderId" = o.id
  AND p.status = 'APPROVED'
  AND o.status = 'PAID';

UPDATE "Payment"
SET "externalId" = pg_temp.canonical_operation_number("externalId");

DROP FUNCTION pg_temp.canonical_operation_number(TEXT);

DROP INDEX "Payment_provider_externalId_key";

CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");
