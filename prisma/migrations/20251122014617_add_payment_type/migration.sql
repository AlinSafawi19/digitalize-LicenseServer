-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'initial';

-- CreateIndex
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");
