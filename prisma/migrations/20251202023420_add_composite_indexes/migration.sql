-- CreateIndex
CREATE INDEX "Activation_licenseId_isActive_idx" ON "Activation"("licenseId", "isActive");

-- CreateIndex
CREATE INDEX "License_status_isFreeTrial_idx" ON "License"("status", "isFreeTrial");
