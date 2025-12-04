-- CreateIndex
CREATE INDEX "Activation_isActive_idx" ON "Activation"("isActive");

-- CreateIndex
CREATE INDEX "Activation_activatedAt_idx" ON "Activation"("activatedAt");

-- CreateIndex
CREATE INDEX "License_customerEmail_idx" ON "License"("customerEmail");

-- CreateIndex
CREATE INDEX "License_customerName_idx" ON "License"("customerName");

-- CreateIndex
CREATE INDEX "License_locationName_idx" ON "License"("locationName");

-- CreateIndex
CREATE INDEX "License_createdAt_idx" ON "License"("createdAt");

-- CreateIndex
CREATE INDEX "License_purchaseDate_idx" ON "License"("purchaseDate");

-- CreateIndex
CREATE INDEX "Payment_isAnnualSubscription_idx" ON "Payment"("isAnnualSubscription");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- CreateIndex
CREATE INDEX "Subscription_startDate_idx" ON "Subscription"("startDate");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");
