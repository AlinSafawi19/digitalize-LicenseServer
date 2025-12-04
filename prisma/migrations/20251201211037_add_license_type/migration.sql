-- AlterTable
ALTER TABLE "License" ADD COLUMN     "licenseType" TEXT NOT NULL DEFAULT 'retail';

-- CreateIndex
CREATE INDEX "License_licenseType_idx" ON "License"("licenseType");
