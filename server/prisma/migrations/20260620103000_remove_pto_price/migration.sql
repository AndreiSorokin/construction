DELETE FROM "RequestPriceHistory"
WHERE "field" = 'PTO_LIMIT_PRICE';

ALTER TYPE "PriceField" RENAME TO "PriceField_old";
CREATE TYPE "PriceField" AS ENUM ('SUPPLIER_PURCHASE_PRICE');

ALTER TABLE "RequestPriceHistory"
ALTER COLUMN "field" TYPE "PriceField"
USING ("field"::text::"PriceField");

DROP TYPE "PriceField_old";

ALTER TABLE "SupplyRequestItem"
DROP COLUMN "ptoLimitPrice";
