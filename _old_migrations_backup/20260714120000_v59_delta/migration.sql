-- Дельта v59: связь, объединение заявок, вложения нарядов, настройки, черновики.
-- Применяется штатно: `npm run prisma:migrate` (prisma migrate deploy/dev).

-- новые действия истории
ALTER TYPE "DecisionAction" ADD VALUE IF NOT EXISTS 'EDITED';
ALTER TYPE "DecisionAction" ADD VALUE IF NOT EXISTS 'RESUBMITTED';
ALTER TYPE "DecisionAction" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TYPE "DecisionAction" ADD VALUE IF NOT EXISTS 'CONSOLIDATED';
ALTER TYPE "DecisionAction" ADD VALUE IF NOT EXISTS 'UNCONSOLIDATED';

-- User: право на цены, тема, аватар
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "canPrice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;

-- позиции: «получено», срок поставки, ссылки сводной
ALTER TABLE "RequestItem"
  ADD COLUMN IF NOT EXISTS "deliveredQty" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "eta" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "srcRefs" JSONB;

-- заявки: потрачено + объединение
ALTER TABLE "Request"
  ADD COLUMN IF NOT EXISTS "spent" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "isConsolidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consolidatedIntoId" TEXT,
  ADD COLUMN IF NOT EXISTS "wasConsolidated" TEXT;
ALTER TABLE "Request"
  ADD CONSTRAINT "Request_consolidatedIntoId_fkey"
  FOREIGN KEY ("consolidatedIntoId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- вложения: привязка к нарядам + пометка переноса из сводной
ALTER TABLE "Attachment"
  ADD COLUMN IF NOT EXISTS "orderId" TEXT,
  ADD COLUMN IF NOT EXISTS "fromConsolidated" TEXT;
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Attachment_orderId_idx" ON "Attachment"("orderId");

-- настройки приложения (единственная строка id='app')
CREATE TABLE IF NOT EXISTS "AppSetting" (
  "id" TEXT NOT NULL DEFAULT 'app',
  "urgentLimit" INTEGER NOT NULL DEFAULT 3,
  "logoKey" TEXT,
  "logoW" INTEGER,
  "logoH" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
INSERT INTO "AppSetting" ("id","urgentLimit","updatedAt") VALUES ('app',3,NOW())
  ON CONFLICT ("id") DO NOTHING;

-- связь: сообщения админу (односторонний список), анонимка (БЕЗ автора)
CREATE TABLE IF NOT EXISTS "AdminMessage" (
  "id" TEXT NOT NULL,
  "fromId" TEXT NOT NULL,
  "fromName" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminMessage_createdAt_idx" ON "AdminMessage"("createdAt");

CREATE TABLE IF NOT EXISTS "AnonMessage" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnonMessage_pkey" PRIMARY KEY ("id")
);

-- объявления + отметки прочтения
CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "byId" TEXT NOT NULL,
  "byName" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("announcementId","userId"),
  CONSTRAINT "AnnouncementRead_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- общий календарь
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "byId" TEXT NOT NULL,
  "byName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CalendarEvent_date_idx" ON "CalendarEvent"("date");

-- черновики заявок: один на пользователя и тип
CREATE TABLE IF NOT EXISTS "Draft" (
  "userId" TEXT NOT NULL,
  "type" "RequestType" NOT NULL,
  "payload" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Draft_pkey" PRIMARY KEY ("userId","type")
);
