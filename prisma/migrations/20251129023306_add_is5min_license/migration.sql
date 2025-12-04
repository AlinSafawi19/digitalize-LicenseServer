-- AlterTable
ALTER TABLE "License" ADD COLUMN     "is5MinLicense" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "License_is5MinLicense_idx" ON "License"("is5MinLicense");
