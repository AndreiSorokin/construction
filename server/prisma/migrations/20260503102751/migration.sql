/*
  Warnings:

  - Added the required column `type` to the `SupplyRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SupplyRequestType" AS ENUM ('MATERIAL', 'TRANSPORT', 'MONEY');

-- AlterTable
ALTER TABLE "SupplyRequest" ADD COLUMN     "amount" DECIMAL(18,2),
ADD COLUMN     "paymentPurpose" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "transportType" TEXT,
ADD COLUMN     "type" "SupplyRequestType" NOT NULL;

-- CreateIndex
CREATE INDEX "SupplyRequest_type_idx" ON "SupplyRequest"("type");
