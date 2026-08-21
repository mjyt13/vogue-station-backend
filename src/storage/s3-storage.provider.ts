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
  // Separate client used only to *sign* URLs handed to the browser. `client`
  // above talks to S3_ENDPOINT, which for MinIO is the internal
  // docker-network host (e.g. http://minio:9000) — fine for the backend's
  // own GetObject/PutObject calls, but a presigned URL built from it is
  // unreachable from outside the network (and, over http on an https page,
  // blocked as mixed content). Presigned URLs must be built against
  // whatever public origin actually proxies to the bucket.
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const region = config.get<string>('S3_REGION') ?? 'auto';
    const forcePathStyle = config.get<string>('S3_FORCE_PATH_STYLE') === 'true';
    const credentials = {
      accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
    };
    this.client = new S3Client({
      region,
      endpoint: config.get<string>('S3_ENDPOINT'),
      // MinIO needs path-style (bucket in the path, not the subdomain)
      forcePathStyle,
      credentials,
    });
    this.publicClient = new S3Client({
      region,
      endpoint:
        config.get<string>('S3_PUBLIC_ENDPOINT') ??
        config.get<string>('S3_ENDPOINT'),
      forcePathStyle,
      credentials,
    });
  }

  getSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  putSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return getSignedUrl(
      this.publicClient,
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
