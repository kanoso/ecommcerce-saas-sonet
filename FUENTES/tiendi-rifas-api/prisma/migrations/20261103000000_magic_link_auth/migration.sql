-- F6, D4: buyers and operators sign in with a one-time email link. A link
-- row names an address, not a user: the user is created when the link is
-- used. Only the SHA-256 of the token is stored on it. The access email waits
-- in the outbox, which therefore gets rows that belong to no order.

-- AlterTable
ALTER TABLE "NotificationOutbox" ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "raffleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthMagicLink" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthMagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthMagicLink_tokenHash_key" ON "AuthMagicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthMagicLink_email_createdAt_idx" ON "AuthMagicLink"("email", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only an access email may have no order and no raffle.
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_order_unless_access_link"
  CHECK (type = 'MAGIC_LINK' OR ("orderId" IS NOT NULL AND "raffleId" IS NOT NULL));
