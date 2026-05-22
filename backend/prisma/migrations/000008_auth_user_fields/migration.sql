-- AlterTable: migrate User from email/passwordHash to name/pinHash with lockout fields
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);

UPDATE "User" SET "name" = "email", "pinHash" = "passwordHash" WHERE "name" IS NULL;

ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "pinHash" SET NOT NULL;

DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" DROP COLUMN "email";
ALTER TABLE "User" DROP COLUMN "passwordHash";

CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
