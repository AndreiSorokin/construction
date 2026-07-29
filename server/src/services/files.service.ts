import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class FilesService {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const c = this.config.get<any>('s3');
    this.bucket = c.bucket;
    this.s3 = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      forcePathStyle: c.forcePathStyle,
      credentials: c.accessKeyId
        ? { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey }
        : undefined,
    });
  }

  async upload(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }) {
    const ext = file.originalname.match(/\.[A-Za-z0-9]+$/)?.[0] || '';
    const key = `att/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return { key, filename: file.originalname, mime: file.mimetype, size: file.size };
  }

  /** временная подписанная ссылка на скачивание (приватный бакет) */
  signedGetUrl(key: string, expiresIn = 300) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  async remove(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
