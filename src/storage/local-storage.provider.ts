import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';
import {
  DEFAULT_SIGNED_URL_TTL,
  StorageProvider,
} from './storage-provider.interface';

/**
 * Dev filesystem backend. Mimics S3 presigning with HMAC-signed, expiring
 * URLs served by StorageController — same contract as the real thing.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly appUrl: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_LOCAL_ROOT') ?? 'storage');
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:3000';
    this.secret = config.getOrThrow<string>('STORAGE_SIGNING_SECRET');
  }

  getSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return Promise.resolve(this.buildUrl('GET', key, ttlSeconds));
  }

  putSignedUrl(key: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL) {
    return Promise.resolve(this.buildUrl('PUT', key, ttlSeconds));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  /** Maps a key to a path under the storage root; rejects traversal. */
  resolveKey(key: string): string {
    if (isAbsolute(key) || normalize(key).split(sep).includes('..')) {
      throw new Error(`Unsafe object key: ${key}`);
    }
    return join(this.root, normalize(key));
  }

  verify(method: string, key: string, expires: number, sig: string): boolean {
    if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(method, key, expires), 'hex');
    const actual = Buffer.from(sig, 'hex');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private buildUrl(method: string, key: string, ttlSeconds: number): string {
    this.resolveKey(key); // validate early
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(method, key, expires);
    return `${this.appUrl}/storage/local/${key}?expires=${expires}&sig=${sig}`;
  }

  private sign(method: string, key: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${method}:${key}:${expires}`)
      .digest('hex');
  }
}
