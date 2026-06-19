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

  try {
    const invoices = await prisma.supplyRequestInvoice.findMany();

    for (const invoice of invoices) {
      if (invoice.path.startsWith("s3://")) {
        skipped += 1;
        continue;
      }

      const storagePath = await storage.migrateLocalFile(
        invoice.path,
        "invoices",
        invoice.storedName,
        invoice.mimeType,
      );

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

      const storagePath = await storage.migrateLocalFile(
        attachment.path,
        "attachments",
        attachment.storedName,
        attachment.mimeType,
      );

      await prisma.supplyRequestAttachment.update({
        where: { id: attachment.id },
        data: { path: storagePath },
      });
      migrated += 1;
    }

    console.log(
      `S3 migration completed. Migrated: ${migrated}, skipped: ${skipped}`,
    );
  } finally {
    await app.close();
  }
}

void migrateLocalFiles().catch((error: unknown) => {
  console.error("S3 migration failed", error);
  process.exitCode = 1;
});
