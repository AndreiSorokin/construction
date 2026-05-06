ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPLY_MANAGER';
ALTER TYPE "SupplyRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_SUPPLY_MANAGER';
ALTER TYPE "ApprovalAction" ADD VALUE IF NOT EXISTS 'SENT_TO_SUPPLY_MANAGER';
ALTER TYPE "ApprovalAction" ADD VALUE IF NOT EXISTS 'ASSIGNED_TO_SUPPLY';

ALTER TABLE "SupplyRequest"
  ADD COLUMN "assignedSupplyUserId" TEXT,
  ADD COLUMN "assignedById" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "SupplyRequest"
  ADD CONSTRAINT "SupplyRequest_assignedSupplyUserId_fkey"
  FOREIGN KEY ("assignedSupplyUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplyRequest"
  ADD CONSTRAINT "SupplyRequest_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupplyRequest_assignedSupplyUserId_idx" ON "SupplyRequest"("assignedSupplyUserId");
CREATE INDEX "SupplyRequest_assignedById_idx" ON "SupplyRequest"("assignedById");
