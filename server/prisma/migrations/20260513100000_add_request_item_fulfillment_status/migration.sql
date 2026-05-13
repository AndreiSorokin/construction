CREATE TYPE "SupplyRequestItemFulfillmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

ALTER TABLE "SupplyRequestItem"
ADD COLUMN "fulfillmentStatus" "SupplyRequestItemFulfillmentStatus" NOT NULL DEFAULT 'PENDING';
