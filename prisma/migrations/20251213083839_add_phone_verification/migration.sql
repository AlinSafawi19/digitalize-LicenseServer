/*
  Warnings:

  - You are about to drop the column `email` on the `Admin` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the `Admin` table will be added. If there are existing duplicate values, this will fail.

*/
-- Step 1: Add phone column as nullable first
ALTER TABLE "Admin" ADD COLUMN "phone" TEXT;

-- Step 2: Migrate data from email to phone (use email as phone if email exists, otherwise use placeholder)
UPDATE "Admin" SET "phone" = COALESCE("email", '+1234567890') WHERE "phone" IS NULL;

-- Step 3: Make phone required
ALTER TABLE "Admin" ALTER COLUMN "phone" SET NOT NULL;

-- Step 4: Drop old email indexes and column
DROP INDEX IF EXISTS "Admin_email_idx";
DROP INDEX IF EXISTS "Admin_email_key";
ALTER TABLE "Admin" DROP COLUMN "email";

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneVerification_phone_idx" ON "PhoneVerification"("phone");

-- CreateIndex
CREATE INDEX "PhoneVerification_otpCode_idx" ON "PhoneVerification"("otpCode");

-- CreateIndex
CREATE INDEX "PhoneVerification_expiresAt_idx" ON "PhoneVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "PhoneVerification_verified_idx" ON "PhoneVerification"("verified");

-- CreateIndex
CREATE INDEX "PhoneVerification_phone_verified_idx" ON "PhoneVerification"("phone", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_phone_key" ON "Admin"("phone");

-- CreateIndex
CREATE INDEX "Admin_phone_idx" ON "Admin"("phone");
