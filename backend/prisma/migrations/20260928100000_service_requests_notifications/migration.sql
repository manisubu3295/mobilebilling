-- AlterEnum
ALTER TYPE "ServiceFrequency" ADD VALUE 'CUSTOM';

-- AlterEnum
ALTER TYPE "ServiceJobStatus" ADD VALUE 'REQUESTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_DECIDED';

-- AlterTable
ALTER TABLE "warranties" ADD COLUMN     "frequency_months" INTEGER,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "service_jobs" ADD COLUMN     "is_extra" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "request_note" TEXT,
ADD COLUMN     "requested_by_id" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "service_category" "ServiceCategory";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "recipient_user_id" TEXT;

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_status_idx" ON "notifications"("recipient_user_id", "status");

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

