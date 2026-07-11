/**
 * Seeds the official catalog. Idempotent — safe to run repeatedly.
 * Run with: npm run db:seed (builds first; executes the compiled output).
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import sharp from 'sharp';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { PRESET_PATTERNS } from './preset-patterns';

const CATALOG_TSHIRT_ID = '00000000-0000-4000-8000-000000000001';

const PRESET_COLORS: { id: string; name: string; hex: string }[] = [
  { id: '00000000-0000-4000-8000-00000000c001', name: 'White', hex: '#ffffff' },
  { id: '00000000-0000-4000-8000-00000000c002', name: 'Black', hex: '#1a1a1a' },
  { id: '00000000-0000-4000-8000-00000000c003', name: 'Navy', hex: '#1f3a5f' },
  {
    id: '00000000-0000-4000-8000-00000000c004',
    name: 'Crimson',
    hex: '#9d2235',
  },
  { id: '00000000-0000-4000-8000-00000000c005', name: 'Sage', hex: '#9caf88' },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Admin bootstrap: roles are never client-assignable, so the first admin
  // comes from the environment. No-op when unset or already registered.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN' },
        });
        console.log(`Promoted ${adminEmail} to ADMIN`);
      }
    } else {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: await argon2.hash(adminPassword, {
            type: argon2.argon2id,
          }),
          role: 'ADMIN',
        },
      });
      console.log(`Created admin user ${adminEmail}`);
    }
  }

  for (const preset of PRESET_COLORS) {
    await prisma.color.upsert({
      where: { id: preset.id },
      update: {},
      create: { ...preset, ownerId: null, isPublic: true },
    });
  }
  console.log(`Seeded ${PRESET_COLORS.length} preset colors`);

  // Preset patterns: rows only — `npm run storage:bootstrap` uploads the bytes.
  for (const preset of PRESET_PATTERNS) {
    const meta = await sharp(preset.localPath).metadata();
    await prisma.pattern.upsert({
      where: { id: preset.id },
      update: {},
      create: {
        id: preset.id,
        name: preset.name,
        objectKey: preset.objectKey,
        thumbnailKey: preset.thumbnailKey,
        mime: 'image/png',
        width: meta.width,
        height: meta.height,
        confirmed: true,
        ownerId: null,
        publishRequested: true,
        isPublic: true,
        status: 'APPROVED',
      },
    });
  }
  console.log(`Seeded ${PRESET_PATTERNS.length} preset patterns`);

  const tshirt = await prisma.garmentModel.upsert({
    where: { id: CATALOG_TSHIRT_ID },
    update: {},
    create: {
      id: CATALOG_TSHIRT_ID,
      name: 'Basic T-Shirt',
      kind: 'TSHIRT',
      objectKey: 'models/tshirt-v1.glb',
      ownerId: null,
      isPublic: true,
      status: 'APPROVED',
      version: 1,
    },
  });
  console.log(`Seeded catalog model: ${tshirt.name} (${tshirt.id})`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
