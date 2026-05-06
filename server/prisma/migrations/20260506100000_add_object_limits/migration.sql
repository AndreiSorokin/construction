CREATE TYPE "ObjectLimitType" AS ENUM ('MATERIAL', 'TRANSPORT', 'MONEY');

CREATE TABLE "ObjectLimit" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "type" "ObjectLimitType" NOT NULL,
  "limitAmount" DECIMAL(18, 2) NOT NULL,
  "spentAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ObjectLimit_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ObjectLimit" (
  "id",
  "objectId",
  "type",
  "limitAmount",
  "spentAmount",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('limit-material-', "id"),
  "id",
  'MATERIAL'::"ObjectLimitType",
  "closingLimit",
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ObjectEntity"
WHERE "type" = 'CONSTRUCTION_OBJECT';

INSERT INTO "ObjectLimit" (
  "id",
  "objectId",
  "type",
  "limitAmount",
  "spentAmount",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('limit-transport-', "id"),
  "id",
  'TRANSPORT'::"ObjectLimitType",
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ObjectEntity"
WHERE "type" = 'CONSTRUCTION_OBJECT';

INSERT INTO "ObjectLimit" (
  "id",
  "objectId",
  "type",
  "limitAmount",
  "spentAmount",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('limit-money-', "id"),
  "id",
  'MONEY'::"ObjectLimitType",
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ObjectEntity"
WHERE "type" = 'CONSTRUCTION_OBJECT';

ALTER TABLE "ObjectLimit"
  ADD CONSTRAINT "ObjectLimit_objectId_fkey"
  FOREIGN KEY ("objectId") REFERENCES "ObjectEntity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ObjectLimit_objectId_type_key" ON "ObjectLimit"("objectId", "type");
CREATE INDEX "ObjectLimit_objectId_idx" ON "ObjectLimit"("objectId");

ALTER TABLE "ObjectEntity" DROP COLUMN "closingLimit";
