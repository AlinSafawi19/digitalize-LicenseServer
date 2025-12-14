/*
  Warnings:

  - You are about to drop the column `customerEmail` on the `License` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "License_customerEmail_idx";

-- DropIndex
DROP INDEX "License_customerEmail_locationName_idx";

-- AlterTable
ALTER TABLE "License" DROP COLUMN "customerEmail",
ADD COLUMN     "customerPhone" TEXT;

-- CreateIndex
CREATE INDEX "License_customerPhone_idx" ON "License"("customerPhone");

-- CreateIndex
CREATE INDEX "License_customerPhone_locationName_idx" ON "License"("customerPhone", "locationName");
