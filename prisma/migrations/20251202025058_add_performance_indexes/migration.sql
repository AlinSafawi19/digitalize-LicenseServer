-- CreateIndex
CREATE INDEX "License_customerEmail_locationName_idx" ON "License"("customerEmail", "locationName");

-- CreateIndex
CREATE INDEX "Payment_licenseId_paymentType_idx" ON "Payment"("licenseId", "paymentType");

-- CreateIndex
CREATE INDEX "Subscription_licenseId_idx" ON "Subscription"("licenseId");
