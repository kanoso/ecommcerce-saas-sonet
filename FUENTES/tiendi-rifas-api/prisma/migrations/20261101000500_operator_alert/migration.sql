-- CreateTable
CREATE TABLE "OperatorAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "raffleTitle" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "readBy" TEXT,

    CONSTRAINT "OperatorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorAlert_readAt_createdAt_idx" ON "OperatorAlert"("readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAlert_type_orderId_key" ON "OperatorAlert"("type", "orderId");

-- AddForeignKey
ALTER TABLE "OperatorAlert" ADD CONSTRAINT "OperatorAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Claims already waiting for an operator get their alert too.
INSERT INTO "OperatorAlert" ("id", "type", "raffleId", "raffleTitle", "orderId", "amount", "createdAt")
SELECT
  gen_random_uuid()::text,
  'LATE_PAYMENT_CLAIM',
  o."raffleId",
  r."title",
  o."id",
  COALESCE(o."declaredAmount", o."totalAmount"),
  o."updatedAt"
FROM "TicketOrder" o
JOIN "Raffle" r ON r."id" = o."raffleId"
WHERE o."status" = 'LATE_PAYMENT_REVIEW';
