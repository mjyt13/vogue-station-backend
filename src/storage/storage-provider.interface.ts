/**
 * Abstract factory seam: swap the storage backend via STORAGE_DRIVER in .env.
 * DB rows store object keys; URLs are built at read time, after authorization.
 */
export interface StorageProvider {
  /** Short-lived URL the browser can GET the object from. */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Short-lived URL the browser can PUT an upload to (direct-to-storage). */
  putSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export const DEFAULT_SIGNED_URL_TTL = 10 * 60; // 10 minutes
