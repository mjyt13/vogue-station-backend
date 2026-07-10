import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  DEFAULT_SIGNED_URL_TTL,
  StorageProvider,
} from './storage-provider.interface';

/** S3-compatible backend (Cloudflare R2, MinIO, AWS S3) — prod driver. */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: config.get<string>('S3_REGION') ?? 'auto',
      endpoint: config.get<string>('S3_ENDPOINT'),
      // MinIO needs path-style (bucket in the path, not the subdomain)
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  getSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  putSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getObject(key: string, maxBytes?: number): Promise<Buffer | null> {
    try {
      if (maxBytes !== undefined) {
        const head = await this.client.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        if ((head.ContentLength ?? 0) > maxBytes) {
          throw new Error(`Object ${key} exceeds ${maxBytes} bytes`);
        }
      }
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (error) {
      if (
        error instanceof Error &&
        ['NoSuchKey', 'NotFound'].includes(error.name)
      ) {
        return null;
      }
      throw error;
    }
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }),
    );
  }
}
