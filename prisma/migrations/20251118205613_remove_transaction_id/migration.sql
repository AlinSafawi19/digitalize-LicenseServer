/*
  Warnings:

  - You are about to drop the column `transactionId` on the `Payment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Payment_transactionId_idx";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "transactionId";
