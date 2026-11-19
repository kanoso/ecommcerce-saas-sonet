-- Readable code of the buyers created by in-person sales, such as JUAN-PEREZ
-- or JUAN-PEREZ-2. Existing users keep NULL: no backfill.
ALTER TABLE "User" ADD COLUMN "buyerCode" TEXT;

-- One buyer per code. Concurrent sales that compute the same correlative
-- collide here, and the application retries with the next one.
CREATE UNIQUE INDEX "User_buyerCode_key" ON "User"("buyerCode");

-- Always stored normalized (uppercase letters and digits joined by single
-- dashes), so the exact lookup of a normalized input is case-insensitive.
ALTER TABLE "User" ADD CONSTRAINT "User_buyerCode_format"
  CHECK ("buyerCode" IS NULL OR "buyerCode" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');
