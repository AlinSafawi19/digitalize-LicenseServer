-- AlterTable
ALTER TABLE "License" ADD COLUMN     "freeTrialEndDate" TIMESTAMP(3),
ADD COLUMN     "isFreeTrial" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "License_isFreeTrial_idx" ON "License"("isFreeTrial");

-- CreateIndex
CREATE INDEX "License_freeTrialEndDate_idx" ON "License"("freeTrialEndDate");
