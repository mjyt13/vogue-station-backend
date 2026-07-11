-- AlterTable
ALTER TABLE "looks" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publish_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "looks_is_public_status_idx" ON "looks"("is_public", "status");

