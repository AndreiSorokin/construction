-- AlterEnum
ALTER TYPE "DecisionAction" ADD VALUE 'AUTO_CONFIRMED';

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "fulfilledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Request_status_fulfilledAt_idx" ON "Request"("status", "fulfilledAt");
