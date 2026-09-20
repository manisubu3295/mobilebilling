-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_LEAD';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "lead_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
