-- DropIndex
DROP INDEX "colors_is_public_idx";

-- AlterTable
ALTER TABLE "colors" ADD COLUMN     "publish_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "garment_models" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thumbnail_key" TEXT;

-- CreateIndex
CREATE INDEX "colors_is_public_status_idx" ON "colors"("is_public", "status");

-- CreateIndex
CREATE INDEX "colors_status_idx" ON "colors"("status");

-- CreateIndex
CREATE INDEX "garment_models_status_idx" ON "garment_models"("status");
