-- CreateIndex
CREATE INDEX "Activation_activatedAt_isActive_idx" ON "Activation"("activatedAt", "isActive");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_isAnnualSubscription_idx" ON "Payment"("paymentDate", "isAnnualSubscription");
