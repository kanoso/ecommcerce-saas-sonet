-- DT-19: the operator accounts buyers transfer to live in the database.
-- Four eyes: a new account, a new method, holder, number or CCI, and an
-- activation are proposed by one operator and approved by another
-- (PaymentAccountChange). Every event leaves an append-only audit row, an
-- in-app operator alert and an alert email, in the same transaction. An
-- order keeps a copy of the account its buyer declared paying to.

-- AlterTable
ALTER TABLE "OperatorAlert" ADD COLUMN     "paymentAccountId" TEXT,
ALTER COLUMN "raffleId" DROP NOT NULL,
ALTER COLUMN "raffleTitle" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TicketOrder" ADD COLUMN     "paidToAccount" JSONB,
ADD COLUMN     "paidToAccountId" TEXT;

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "cci" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccountChange" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "proposed" JSONB,
    "before" JSONB,
    "status" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAccountChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccountAudit" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "changeId" TEXT,
    "action" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "txId" BIGINT NOT NULL DEFAULT txid_current(),

    CONSTRAINT "PaymentAccountAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAccount_active_displayOrder_idx" ON "PaymentAccount"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_method_accountNumber_key" ON "PaymentAccount"("method", "accountNumber");

-- CreateIndex
CREATE INDEX "PaymentAccountChange_status_proposedAt_idx" ON "PaymentAccountChange"("status", "proposedAt");

-- CreateIndex
CREATE INDEX "PaymentAccountChange_accountId_idx" ON "PaymentAccountChange"("accountId");

-- CreateIndex
CREATE INDEX "PaymentAccountAudit_accountId_occurredAt_idx" ON "PaymentAccountAudit"("accountId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PaymentAccountAudit" ADD CONSTRAINT "PaymentAccountAudit_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "PaymentAccountChange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The methods of proof upload, and a CCI only for a bank.
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_method_check"
  CHECK ("method" IN ('YAPE', 'PLIN', 'BCP', 'BBVA', 'INTERBANK'));
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_wallet_without_cci"
  CHECK ("method" NOT IN ('YAPE', 'PLIN') OR "cci" IS NULL);
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_version_positive"
  CHECK ("version" >= 1);
ALTER TABLE "PaymentAccountAudit" ADD CONSTRAINT "PaymentAccountAudit_action_check"
  CHECK ("action" IN ('PROPOSED', 'APPROVED', 'REJECTED', 'CANCELLED', 'DEACTIVATED', 'REORDERED'));
ALTER TABLE "PaymentAccountChange" ADD CONSTRAINT "PaymentAccountChange_kind_check"
  CHECK ("kind" IN ('CREATE', 'UPDATE', 'ACTIVATE'));
ALTER TABLE "PaymentAccountChange" ADD CONSTRAINT "PaymentAccountChange_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'));
-- Four eyes in the database too: whoever decides is not the proposer, except
-- for a cancellation, which only the proposer makes.
ALTER TABLE "PaymentAccountChange" ADD CONSTRAINT "PaymentAccountChange_four_eyes"
  CHECK (
    ("status" = 'PENDING' AND "decidedBy" IS NULL AND "decidedAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "decidedBy" = "proposedBy" AND "decidedAt" IS NOT NULL)
    OR ("status" IN ('APPROVED', 'REJECTED') AND "decidedBy" IS NOT NULL AND "decidedBy" <> "proposedBy" AND "decidedAt" IS NOT NULL)
  );

-- Operator ids in canonical form (DT-17), so letter case cannot make the
-- approver look different from the proposer.
ALTER TABLE "PaymentAccountChange" ADD CONSTRAINT "PaymentAccountChange_canonical_operators"
  CHECK (
    "proposedBy" ~ '^[a-z0-9._@-]{1,128}$'
    AND ("decidedBy" IS NULL OR "decidedBy" ~ '^[a-z0-9._@-]{1,128}$')
  );
ALTER TABLE "PaymentAccountAudit" ADD CONSTRAINT "PaymentAccountAudit_canonical_operator"
  CHECK ("operatorId" ~ '^[a-z0-9._@-]{1,128}$');
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_canonical_operators"
  CHECK ("createdBy" ~ '^[a-z0-9._@-]{1,128}$' AND "updatedBy" ~ '^[a-z0-9._@-]{1,128}$');

-- One pending change per account, and one pending proposal per destination
-- (method and number) across accounts. Prisma cannot declare partial or
-- expression indexes: integration tests fail without them.
CREATE UNIQUE INDEX "PaymentAccountChange_one_pending_per_account"
  ON "PaymentAccountChange"("accountId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "PaymentAccountChange_pending_destination_key"
  ON "PaymentAccountChange"(("proposed"->>'method'), ("proposed"->>'accountNumber'))
  WHERE "status" = 'PENDING' AND "proposed" IS NOT NULL;

-- An account is deactivated, never deleted.
CREATE OR REPLACE FUNCTION payment_account_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PaymentAccount rows are never deleted: deactivate the account';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_account_no_delete
BEFORE DELETE ON "PaymentAccount"
FOR EACH ROW EXECUTE FUNCTION payment_account_no_delete();

CREATE TRIGGER trg_payment_account_no_truncate
BEFORE TRUNCATE ON "PaymentAccount"
FOR EACH STATEMENT EXECUTE FUNCTION payment_account_no_delete();

-- No write to an account without its audit row in the same transaction, so
-- a script cannot change where the money goes unseen. A new destination (an
-- insert, a new method, holder, number or CCI, or an activation) also needs
-- the approval: an APPROVED audit row of a change that is APPROVED. A
-- deactivation or a reorder needs its own audit row only. Checked right after
-- each account write, so the change and the audit row are written first. Not
-- deferred to the commit on purpose: Prisma 5.22 resolves an interactive
-- transaction whose COMMIT fails, so a deferred error would reach no caller.
-- Defence in depth: whoever can write these tables directly can also forge
-- the approval rows (DT-19).
CREATE OR REPLACE FUNCTION payment_account_requires_audit()
RETURNS TRIGGER AS $$
DECLARE
  new_destination BOOLEAN;
BEGIN
  new_destination := TG_OP = 'INSERT'
    OR NEW."method" IS DISTINCT FROM OLD."method"
    OR NEW."holderName" IS DISTINCT FROM OLD."holderName"
    OR NEW."accountNumber" IS DISTINCT FROM OLD."accountNumber"
    OR NEW."cci" IS DISTINCT FROM OLD."cci"
    OR (NEW."active" AND NOT OLD."active");
  IF new_destination THEN
    IF NOT EXISTS (
      SELECT 1 FROM "PaymentAccountAudit" a
      JOIN "PaymentAccountChange" c ON c."id" = a."changeId"
      WHERE a."accountId" = NEW."id" AND a."txId" = txid_current()
        AND a."action" = 'APPROVED' AND c."status" = 'APPROVED' AND c."accountId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'PaymentAccount destination changes need an approved change in the same transaction (account %)', NEW."id";
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM "PaymentAccountAudit" a
    WHERE a."accountId" = NEW."id" AND a."txId" = txid_current()
  ) THEN
    RAISE EXCEPTION 'PaymentAccount writes need an audit row in the same transaction (account %)', NEW."id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_account_requires_audit
AFTER INSERT OR UPDATE ON "PaymentAccount"
FOR EACH ROW EXECUTE FUNCTION payment_account_requires_audit();

-- The audit of where the money goes is append-only.
CREATE OR REPLACE FUNCTION payment_account_audit_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PaymentAccountAudit records are append-only: % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_account_audit_append_only
BEFORE UPDATE OR DELETE ON "PaymentAccountAudit"
FOR EACH ROW EXECUTE FUNCTION payment_account_audit_append_only();

CREATE TRIGGER trg_payment_account_audit_no_truncate
BEFORE TRUNCATE ON "PaymentAccountAudit"
FOR EACH STATEMENT EXECUTE FUNCTION payment_account_audit_append_only();

-- A change is decided once, and never deleted.
CREATE OR REPLACE FUNCTION payment_account_change_decided_once()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING'
     AND NEW."id" = OLD."id" AND NEW."kind" = OLD."kind" AND NEW."accountId" = OLD."accountId"
     AND NEW."proposed" IS NOT DISTINCT FROM OLD."proposed"
     AND NEW."before" IS NOT DISTINCT FROM OLD."before"
     AND NEW."proposedBy" = OLD."proposedBy" AND NEW."proposedAt" = OLD."proposedAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PaymentAccountChange % is decided or immutable: % is prohibited', OLD."id", TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_account_change_decided_once
BEFORE UPDATE OR DELETE ON "PaymentAccountChange"
FOR EACH ROW EXECUTE FUNCTION payment_account_change_decided_once();

-- The operators' alert of an account change belongs to no order.
ALTER TABLE "NotificationOutbox" DROP CONSTRAINT "NotificationOutbox_order_unless_access_link";
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_order_unless_orderless_type"
  CHECK (
    type IN ('MAGIC_LINK', 'PAYMENT_ACCOUNT_CHANGED')
    OR ("orderId" IS NOT NULL AND "raffleId" IS NOT NULL)
  );

-- Only a payment account alert is about no raffle.
ALTER TABLE "OperatorAlert" ADD CONSTRAINT "OperatorAlert_raffle_unless_payment_account"
  CHECK (
    (type = 'PAYMENT_ACCOUNT_CHANGE' AND "paymentAccountId" IS NOT NULL)
    OR ("raffleId" IS NOT NULL AND "raffleTitle" IS NOT NULL)
  );

-- The paid-to id and its copy go together and agree.
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_paid_to_consistent"
  CHECK (
    ("paidToAccountId" IS NULL AND "paidToAccount" IS NULL)
    OR ("paidToAccountId" IS NOT NULL AND "paidToAccount" IS NOT NULL
        AND "paidToAccountId" = "paidToAccount"->>'accountId')
  );

-- The account a buyer declared paying to is kept as it was: once set, its
-- id and copy are never replaced nor cleared.
CREATE OR REPLACE FUNCTION ticket_order_paid_to_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."paidToAccountId" IS NOT NULL AND (
    NEW."paidToAccountId" IS DISTINCT FROM OLD."paidToAccountId"
    OR NEW."paidToAccount" IS DISTINCT FROM OLD."paidToAccount"
  ) THEN
    RAISE EXCEPTION 'The paid-to account of order % cannot change once declared', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_order_paid_to_immutable
BEFORE UPDATE ON "TicketOrder"
FOR EACH ROW EXECUTE FUNCTION ticket_order_paid_to_immutable();
