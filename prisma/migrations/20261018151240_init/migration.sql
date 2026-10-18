-- CreateEnum
CREATE TYPE "CapsuleType" AS ENUM ('TEXT', 'DOODLE', 'CASSETTE', 'SEALED', 'PASS_DOODLE');

-- CreateEnum
CREATE TYPE "CapsuleStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'FLAGGED');

-- CreateTable
CREATE TABLE "desks" (
    "id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "tag_counts" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capsules" (
    "id" TEXT NOT NULL,
    "desk_id" TEXT NOT NULL,
    "type" "CapsuleType" NOT NULL,
    "author_alias" TEXT,
    "text_content" TEXT,
    "doodle_data" TEXT,
    "track_url" TEXT,
    "track_metadata" JSONB,
    "is_sealed" BOOLEAN NOT NULL DEFAULT false,
    "is_opened" BOOLEAN NOT NULL DEFAULT false,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CapsuleStatus" NOT NULL DEFAULT 'PUBLISHED',
    "device_hash" TEXT NOT NULL,
    "pass_parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capsules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" TEXT NOT NULL,
    "desk_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "token_used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "capsule_id" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capsules_desk_id_status_created_at_idx" ON "capsules"("desk_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_capsule_id_device_hash_key" ON "reports"("capsule_id", "device_hash");

-- AddForeignKey
ALTER TABLE "capsules" ADD CONSTRAINT "capsules_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "desks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capsules" ADD CONSTRAINT "capsules_pass_parent_id_fkey" FOREIGN KEY ("pass_parent_id") REFERENCES "capsules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "desks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_capsule_id_fkey" FOREIGN KEY ("capsule_id") REFERENCES "capsules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
