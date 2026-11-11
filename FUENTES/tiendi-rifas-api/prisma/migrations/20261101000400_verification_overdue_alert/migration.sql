-- AlterTable
ALTER TABLE "TicketOrder" ADD COLUMN     "overdueAlertedAt" TIMESTAMP(3),
ADD COLUMN     "verificationDueAt" TIMESTAMP(3);

-- Orders already in verification carried their deadline in expiresAt.
UPDATE "TicketOrder"
SET "verificationDueAt" = "expiresAt"
WHERE status = 'PENDING_VERIFICATION';

-- CreateIndex
CREATE INDEX "TicketOrder_status_verificationDueAt_idx" ON "TicketOrder"("status", "verificationDueAt");
