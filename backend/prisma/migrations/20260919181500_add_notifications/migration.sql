-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SERVICE_JOB_COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'ACKNOWLEDGED', 'ACTION_NOTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "service_job_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "action_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_store_id_status_idx" ON "notifications"("store_id", "status");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_service_job_id_fkey" FOREIGN KEY ("service_job_id") REFERENCES "service_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
