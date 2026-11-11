-- AlterTable
ALTER TABLE "TicketOrder" ADD COLUMN "declaredAmount" DECIMAL(10,2);

-- DropTable
DROP TABLE "WebhookEvent";

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "operatorId" TEXT,
    "destination" TEXT,
    "operationNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_orderId_key" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_raffleId_idx" ON "Refund"("raffleId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariant: a sale only happens on an active raffle, so the list frozen at the
-- close of sales cannot change, even from a writer that skips the application.
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

  IF NEW.status = 'SOLD'
     AND (SELECT status FROM "Raffle" WHERE id = NEW."raffleId") <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Invalid ticket transition: ticket % cannot be sold on a raffle that is not ACTIVE', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
