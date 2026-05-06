CREATE TABLE "SupplyRequestInvoice" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequestInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyRequestInvoice_requestId_idx" ON "SupplyRequestInvoice"("requestId");
CREATE INDEX "SupplyRequestInvoice_uploadedById_idx" ON "SupplyRequestInvoice"("uploadedById");

ALTER TABLE "SupplyRequestInvoice" ADD CONSTRAINT "SupplyRequestInvoice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupplyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyRequestInvoice" ADD CONSTRAINT "SupplyRequestInvoice_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
