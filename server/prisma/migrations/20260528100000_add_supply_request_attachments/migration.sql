CREATE TABLE IF NOT EXISTS "SupplyRequestAttachment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplyRequestAttachment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupplyRequestAttachment_requestId_fkey'
  ) THEN
    ALTER TABLE "SupplyRequestAttachment"
    ADD CONSTRAINT "SupplyRequestAttachment_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "SupplyRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupplyRequestAttachment_uploadedById_fkey'
  ) THEN
    ALTER TABLE "SupplyRequestAttachment"
    ADD CONSTRAINT "SupplyRequestAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupplyRequestAttachment_requestId_idx"
ON "SupplyRequestAttachment"("requestId");

CREATE INDEX IF NOT EXISTS "SupplyRequestAttachment_uploadedById_idx"
ON "SupplyRequestAttachment"("uploadedById");
