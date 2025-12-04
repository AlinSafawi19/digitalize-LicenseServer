/*
  Warnings:

  - You are about to drop the column `is5MinLicense` on the `License` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "License_is5MinLicense_idx";

-- AlterTable
ALTER TABLE "License" DROP COLUMN "is5MinLicense",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "License_startDate_idx" ON "License"("startDate");

-- CreateIndex
CREATE INDEX "License_endDate_idx" ON "License"("endDate");
