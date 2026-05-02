-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FOREMAN', 'SITE_MANAGER', 'SUPPLY', 'PTO', 'CHIEF_ENGINEER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "ObjectType" AS ENUM ('CONSTRUCTION_OBJECT', 'INTERNAL_DEPARTMENT');

-- CreateEnum
CREATE TYPE "UserObjectRole" AS ENUM ('OWNER', 'RESPONSIBLE', 'VIEWER');

-- CreateEnum
CREATE TYPE "SupplyRequestStatus" AS ENUM ('CREATED', 'PENDING_PTO', 'PENDING_CHIEF_ENGINEER', 'PENDING_SUPPLY', 'PENDING_DIRECTOR', 'RETURNED_TO_SUPPLY', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('CREATED', 'APPROVED', 'REJECTED', 'RETURNED', 'SENT_TO_PTO', 'SENT_TO_CHIEF_ENGINEER', 'SENT_TO_SUPPLY', 'SENT_TO_DIRECTOR', 'MARKED_IN_PROGRESS', 'COMPLETED', 'ARCHIVED', 'COMMENTED', 'PRICE_UPDATED');

-- CreateEnum
CREATE TYPE "PriceField" AS ENUM ('PTO_LIMIT_PRICE', 'SUPPLIER_PURCHASE_PRICE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ObjectType" NOT NULL,
    "closingLimit" DECIMAL(18,2) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserObjectAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "role" "UserObjectRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserObjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectMaterial" (
    "id" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "measurementUnit" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "status" "SupplyRequestStatus" NOT NULL DEFAULT 'CREATED',
    "objectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "objectMaterialId" TEXT NOT NULL,
    "materialNameSnapshot" TEXT NOT NULL,
    "materialTypeSnapshot" TEXT NOT NULL,
    "measurementUnitSnapshot" TEXT NOT NULL,
    "estimatedPriceSnapshot" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "ptoLimitPrice" DECIMAL(18,2),
    "supplierPurchasePrice" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "fromStatus" "SupplyRequestStatus",
    "toStatus" "SupplyRequestStatus",
    "comment" TEXT,
    "changesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestPriceHistory" (
    "id" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "field" "PriceField" NOT NULL,
    "oldValue" DECIMAL(18,2),
    "newValue" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectEntity_ownerId_idx" ON "ObjectEntity"("ownerId");

-- CreateIndex
CREATE INDEX "UserObjectAccess_objectId_idx" ON "UserObjectAccess"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserObjectAccess_userId_objectId_key" ON "UserObjectAccess"("userId", "objectId");

-- CreateIndex
CREATE INDEX "ObjectMaterial_objectId_idx" ON "ObjectMaterial"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectMaterial_objectId_name_measurementUnit_key" ON "ObjectMaterial"("objectId", "name", "measurementUnit");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_requestNumber_key" ON "SupplyRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "SupplyRequest_objectId_idx" ON "SupplyRequest"("objectId");

-- CreateIndex
CREATE INDEX "SupplyRequest_authorId_idx" ON "SupplyRequest"("authorId");

-- CreateIndex
CREATE INDEX "SupplyRequest_status_idx" ON "SupplyRequest"("status");

-- CreateIndex
CREATE INDEX "SupplyRequestItem_requestId_idx" ON "SupplyRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "SupplyRequestItem_objectMaterialId_idx" ON "SupplyRequestItem"("objectMaterialId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_requestId_idx" ON "ApprovalHistory"("requestId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_actorId_idx" ON "ApprovalHistory"("actorId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_createdAt_idx" ON "ApprovalHistory"("createdAt");

-- CreateIndex
CREATE INDEX "RequestPriceHistory_requestItemId_idx" ON "RequestPriceHistory"("requestItemId");

-- CreateIndex
CREATE INDEX "RequestPriceHistory_actorId_idx" ON "RequestPriceHistory"("actorId");

-- CreateIndex
CREATE INDEX "RequestPriceHistory_createdAt_idx" ON "RequestPriceHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "ObjectEntity" ADD CONSTRAINT "ObjectEntity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserObjectAccess" ADD CONSTRAINT "UserObjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserObjectAccess" ADD CONSTRAINT "UserObjectAccess_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ObjectEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectMaterial" ADD CONSTRAINT "ObjectMaterial_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ObjectEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "ObjectEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestItem" ADD CONSTRAINT "SupplyRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupplyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequestItem" ADD CONSTRAINT "SupplyRequestItem_objectMaterialId_fkey" FOREIGN KEY ("objectMaterialId") REFERENCES "ObjectMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupplyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestPriceHistory" ADD CONSTRAINT "RequestPriceHistory_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "SupplyRequestItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestPriceHistory" ADD CONSTRAINT "RequestPriceHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
