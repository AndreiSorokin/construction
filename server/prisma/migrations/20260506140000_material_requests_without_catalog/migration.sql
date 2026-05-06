DROP INDEX IF EXISTS "SupplyRequestItem_objectMaterialId_idx";

ALTER TABLE "SupplyRequestItem"
  DROP CONSTRAINT IF EXISTS "SupplyRequestItem_objectMaterialId_fkey";

ALTER TABLE "SupplyRequestItem"
  DROP COLUMN IF EXISTS "objectMaterialId";
