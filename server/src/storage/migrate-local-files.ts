import { NotFoundException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "./storage.service";

async function migrateLocalFiles() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const storage = app.get(StorageService);

  if (!storage.isS3Enabled()) {
    throw new Error("Set FILE_STORAGE_DRIVER=s3 before running migration");
  }

  let migrated = 0;
  let skipped = 0;
  let missing = 0;

  try {
    const invoices = await prisma.supplyRequestInvoice.findMany();

    for (const invoice of invoices) {
      if (invoice.path.startsWith("s3://")) {
        skipped += 1;
        continue;
      }

      let storagePath: string;

      try {
        storagePath = await storage.migrateLocalFile(
          invoice.path,
          "invoices",
          invoice.storedName,
          invoice.mimeType,
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }

        missing += 1;
        console.warn(
          `[missing invoice] id=${invoice.id} name=${invoice.originalName} path=${invoice.path}`,
        );
        continue;
      }

      await prisma.supplyRequestInvoice.update({
        where: { id: invoice.id },
        data: { path: storagePath },
      });
      migrated += 1;
    }

    const attachments = await prisma.supplyRequestAttachment.findMany();

    for (const attachment of attachments) {
      if (attachment.path.startsWith("s3://")) {
        skipped += 1;
        continue;
      }

      let storagePath: string;

      try {
        storagePath = await storage.migrateLocalFile(
          attachment.path,
          "attachments",
          attachment.storedName,
          attachment.mimeType,
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }

        missing += 1;
        console.warn(
          `[missing attachment] id=${attachment.id} name=${attachment.originalName} path=${attachment.path}`,
        );
        continue;
      }

      await prisma.supplyRequestAttachment.update({
        where: { id: attachment.id },
        data: { path: storagePath },
      });
      migrated += 1;
    }

    console.log(
      `S3 migration completed. Migrated: ${migrated}, skipped: ${skipped}, missing: ${missing}`,
    );
  } finally {
    await app.close();
  }
}

void migrateLocalFiles().catch((error: unknown) => {
  console.error("S3 migration failed", error);
  process.exitCode = 1;
});
