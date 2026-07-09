/**
 * Seeds the official catalog. Idempotent — safe to run repeatedly.
 * Run with: npm run db:seed (builds first; executes the compiled output).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const CATALOG_TSHIRT_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

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
