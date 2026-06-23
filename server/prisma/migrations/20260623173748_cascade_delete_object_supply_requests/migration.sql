-- DropForeignKey
ALTER TABLE "SupplyRequest" DROP CONSTRAINT "SupplyRequest_objectId_fkey";

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ObjectEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
