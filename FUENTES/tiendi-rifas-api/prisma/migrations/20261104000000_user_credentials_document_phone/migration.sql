-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_document_key" ON "User"("document");
