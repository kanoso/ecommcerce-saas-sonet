-- DT-16: an order keeps one refund of its own, plus one refund per extra
-- transfer, tied to the Payment that recorded it.

-- DropIndex
DROP INDEX "Refund_orderId_key";

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "paymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- One refund of the order itself per order, as before. Prisma cannot declare
-- a partial index; an integration test fails without it.
CREATE UNIQUE INDEX "Refund_order_refund_key" ON "Refund"("orderId") WHERE "paymentId" IS NULL;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
