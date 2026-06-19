import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";

type StorageFolder = "attachments" | "invoices";

@Injectable()
export class StorageService {
  private readonly driver: "local" | "s3";
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly localUploadsDir = join(process.cwd(), "uploads");
  private readonly s3Client: S3Client | null;

  constructor(private readonly config: ConfigService) {
    this.driver =
      this.config.get<string>("FILE_STORAGE_DRIVER") === "s3" ? "s3" : "local";
    this.bucket = this.config.get<string>("S3_BUCKET")?.trim() ?? "";
    this.keyPrefix = this.config.get<string>("S3_KEY_PREFIX")?.trim() ?? "";

    if (this.driver === "s3") {
      const endpoint = this.requireConfig("S3_ENDPOINT");
      const region = this.requireConfig("S3_REGION");
      const accessKeyId = this.requireConfig("S3_ACCESS_KEY_ID");
      const secretAccessKey = this.requireConfig("S3_SECRET_ACCESS_KEY");

      if (!this.bucket) {
        throw new Error("S3_BUCKET is required when FILE_STORAGE_DRIVER=s3");
      }

      this.s3Client = new S3Client({
        endpoint,
        region,
        forcePathStyle:
          this.config.get<string>("S3_FORCE_PATH_STYLE") === "true",
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.s3Client = null;
    }
  }

  async upload(
    folder: StorageFolder,
    storedName: string,
    buffer: Buffer,
    contentType: string,
  ) {
    if (this.driver === "s3") {
      const key = this.createObjectKey(folder, storedName);

      await this.getS3Client().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      return `s3://${this.bucket}/${key}`;
    }

    const directory = join(this.localUploadsDir, folder);
    const filePath = join(directory, storedName);
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, buffer);
    return filePath;
  }

  async get(
    storagePath: string,
    folder: StorageFolder,
    storedName: string,
  ): Promise<Readable> {
    const s3Location = this.parseS3Location(storagePath);

    if (s3Location) {
      const response = await this.getS3Client().send(
        new GetObjectCommand({
          Bucket: s3Location.bucket,
          Key: s3Location.key,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException("Uploaded file is missing in S3 storage");
      }

      return response.Body as Readable;
    }

    const filePath = await this.resolveLocalPath(
      storagePath,
      folder,
      storedName,
    );
    return createReadStream(filePath);
  }

  async delete(storagePath: string, folder: StorageFolder, storedName: string) {
    const s3Location = this.parseS3Location(storagePath);

    if (s3Location) {
      await this.getS3Client().send(
        new DeleteObjectCommand({
          Bucket: s3Location.bucket,
          Key: s3Location.key,
        }),
      );
      return;
    }

    const localPaths = new Set([
      storagePath,
      join(this.localUploadsDir, folder, storedName),
    ]);

    await Promise.all(
      Array.from(localPaths).map((filePath) => this.unlinkIfExists(filePath)),
    );
  }

  isS3Enabled() {
    return this.driver === "s3";
  }

  async migrateLocalFile(
    storagePath: string,
    folder: StorageFolder,
    storedName: string,
    contentType: string,
  ) {
    if (!this.isS3Enabled()) {
      throw new Error("FILE_STORAGE_DRIVER must be s3 to migrate local files");
    }

    if (this.parseS3Location(storagePath)) {
      return storagePath;
    }

    const localPath = await this.resolveLocalPath(
      storagePath,
      folder,
      storedName,
    );
    const buffer = await readFile(localPath);
    return this.upload(folder, storedName, buffer, contentType);
  }

  private createObjectKey(folder: StorageFolder, storedName: string) {
    return [this.keyPrefix, folder, storedName].filter(Boolean).join("/");
  }

  private parseS3Location(storagePath: string) {
    if (!storagePath.startsWith("s3://")) {
      return null;
    }

    const pathWithoutProtocol = storagePath.slice("s3://".length);
    const separatorIndex = pathWithoutProtocol.indexOf("/");

    if (
      separatorIndex < 1 ||
      separatorIndex === pathWithoutProtocol.length - 1
    ) {
      throw new Error(`Invalid S3 storage path: ${storagePath}`);
    }

    return {
      bucket: pathWithoutProtocol.slice(0, separatorIndex),
      key: pathWithoutProtocol.slice(separatorIndex + 1),
    };
  }

  private async resolveLocalPath(
    storagePath: string,
    folder: StorageFolder,
    storedName: string,
  ) {
    const fallbackPath = join(this.localUploadsDir, folder, storedName);

    for (const filePath of [storagePath, fallbackPath]) {
      try {
        await access(filePath);
        return filePath;
      } catch {
        // Try the legacy fallback path before reporting a missing file.
      }
    }

    throw new NotFoundException("Uploaded file is missing on server storage");
  }

  private async unlinkIfExists(filePath: string) {
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  }

  private getS3Client() {
    if (!this.s3Client) {
      throw new Error(
        "S3 client is not configured. Set FILE_STORAGE_DRIVER=s3 and S3 credentials",
      );
    }

    return this.s3Client;
  }

  private requireConfig(name: string) {
    const value = this.config.get<string>(name)?.trim();

    if (!value) {
      throw new Error(`${name} is required when FILE_STORAGE_DRIVER=s3`);
    }

    return value;
  }
}
