ALTER TABLE "SupplyRequest" ADD COLUMN "assignedStorekeeperId" TEXT;

ALTER TABLE "SupplyRequest"
ADD CONSTRAINT "SupplyRequest_assignedStorekeeperId_fkey"
FOREIGN KEY ("assignedStorekeeperId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupplyRequest_assignedStorekeeperId_idx"
ON "SupplyRequest"("assignedStorekeeperId");
