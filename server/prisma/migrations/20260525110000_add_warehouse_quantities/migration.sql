ALTER TABLE "SupplyRequestItem"
ADD COLUMN "orderQuantity" DECIMAL(18, 3) NOT NULL DEFAULT 0,
ADD COLUMN "stockQuantity" DECIMAL(18, 3) NOT NULL DEFAULT 0;

UPDATE "SupplyRequestItem"
SET "orderQuantity" = "quantity"
WHERE "orderQuantity" = 0;
