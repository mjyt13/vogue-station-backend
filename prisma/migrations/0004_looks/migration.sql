-- CreateTable
CREATE TABLE "looks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "garment_model_id" TEXT NOT NULL,
    "color_id" TEXT,
    "color_hex" TEXT NOT NULL,
    "pattern_id" TEXT,
    "pattern_scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "thumbnail_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "looks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "looks_owner_id_idx" ON "looks"("owner_id");

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_garment_model_id_fkey" FOREIGN KEY ("garment_model_id") REFERENCES "garment_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "looks" ADD CONSTRAINT "looks_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

