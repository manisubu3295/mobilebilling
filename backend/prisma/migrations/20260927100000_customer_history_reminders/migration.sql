-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "cost_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "service_jobs" ADD COLUMN     "reminded_at" TIMESTAMP(3),
ADD COLUMN     "reminded_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_reminded_by_id_fkey" FOREIGN KEY ("reminded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

