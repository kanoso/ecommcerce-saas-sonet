-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT,
    "payload" JSONB,
    "orderId" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- Only PENDING rows are ever claimed; SENT rows pile up and stay out of it.
CREATE INDEX "NotificationOutbox_pending_nextAttemptAt_idx" ON "NotificationOutbox"("nextAttemptAt") WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "NotificationOutbox_orderId_idx" ON "NotificationOutbox"("orderId");

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TicketOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
