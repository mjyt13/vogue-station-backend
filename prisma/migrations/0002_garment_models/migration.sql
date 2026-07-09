-- CreateEnum
CREATE TYPE "GarmentKind" AS ENUM ('TSHIRT', 'SHIRT', 'SKIRT', 'PANTS');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "garment_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GarmentKind" NOT NULL,
    "object_key" TEXT NOT NULL,
    "owner_id" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garment_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garment_models_owner_id_idx" ON "garment_models"("owner_id");

-- CreateIndex
CREATE INDEX "garment_models_is_public_status_idx" ON "garment_models"("is_public", "status");

-- AddForeignKey
ALTER TABLE "garment_models" ADD CONSTRAINT "garment_models_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

