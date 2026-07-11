/**
 * One-shot S3 bootstrap: creates the bucket if missing and uploads the
 * catalog assets from the local storage/ directory. Idempotent.
 * Run with: npm run storage:bootstrap (requires STORAGE_DRIVER=s3 vars).
 */
import 'dotenv/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { PRESET_PATTERNS } from '../database/preset-patterns';

const CATALOG_OBJECTS: { key: string; localPath: string; mime: string }[] = [
  {
    key: 'models/tshirt-v1.glb',
    localPath: 'storage/models/tshirt-v1.glb',
    mime: 'model/gltf-binary',
  },
  ...PRESET_PATTERNS.map((preset) => ({
    key: preset.objectKey,
    localPath: preset.localPath,
    mime: 'image/png',
  })),
];

async function main() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET is not set');

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });

  const exists = await client
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    await client
      .send(new CreateBucketCommand({ Bucket: bucket }))
      .catch((error: Error & { Code?: string }) => {
        // Race/HeadBucket quirks: an already-owned bucket is success here.
        if (error.Code !== 'BucketAlreadyOwnedByYou') throw error;
      });
    console.log(`Bucket ${bucket} ready`);
  } else {
    console.log(`Bucket ${bucket} already exists`);
  }

  for (const obj of CATALOG_OBJECTS) {
    const body = await readFile(obj.localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: obj.key,
        Body: body,
        ContentType: obj.mime,
      }),
    );
    console.log(`Uploaded ${obj.key} (${body.length} bytes)`);
  }

  // Gallery thumbnails for the preset patterns.
  for (const preset of PRESET_PATTERNS) {
    const thumbnail = await sharp(preset.localPath)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: preset.thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/webp',
      }),
    );
    console.log(`Uploaded ${preset.thumbnailKey}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
