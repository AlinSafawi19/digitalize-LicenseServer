/*
  Warnings:

  - You are about to drop the column `licenseType` on the `License` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "License_licenseType_idx";

-- AlterTable
ALTER TABLE "License" DROP COLUMN "licenseType";
