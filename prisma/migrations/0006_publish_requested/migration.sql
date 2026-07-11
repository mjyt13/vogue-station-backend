-- AlterTable
ALTER TABLE "garment_models" ADD COLUMN     "publish_requested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "patterns" ADD COLUMN     "publish_requested" BOOLEAN NOT NULL DEFAULT false;

