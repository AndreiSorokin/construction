ALTER TYPE "SupplyRequestType" ADD VALUE IF NOT EXISTS 'PRODUCTION';
ALTER TYPE "SupplyRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_WORKSHOP_MANAGER';
ALTER TYPE "SupplyRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_PRODUCTION_AUTHOR';
ALTER TYPE "ApprovalAction" ADD VALUE IF NOT EXISTS 'SENT_TO_WORKSHOP_MANAGER';

ALTER TABLE "SupplyRequest"
ADD COLUMN IF NOT EXISTS "assignedWorkshopManagerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupplyRequest_assignedWorkshopManagerId_fkey'
  ) THEN
    ALTER TABLE "SupplyRequest"
    ADD CONSTRAINT "SupplyRequest_assignedWorkshopManagerId_fkey"
    FOREIGN KEY ("assignedWorkshopManagerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupplyRequest_assignedWorkshopManagerId_idx"
ON "SupplyRequest"("assignedWorkshopManagerId");
