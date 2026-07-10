-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "owner_id" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "thumbnail_key" TEXT,
    "mime" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colors_owner_id_idx" ON "colors"("owner_id");

-- CreateIndex
CREATE INDEX "colors_is_public_idx" ON "colors"("is_public");

-- CreateIndex
CREATE INDEX "patterns_owner_id_idx" ON "patterns"("owner_id");

-- CreateIndex
CREATE INDEX "patterns_is_public_status_idx" ON "patterns"("is_public", "status");

-- CreateIndex
CREATE INDEX "patterns_status_idx" ON "patterns"("status");

-- AddForeignKey
ALTER TABLE "colors" ADD CONSTRAINT "colors_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patterns" ADD CONSTRAINT "patterns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

