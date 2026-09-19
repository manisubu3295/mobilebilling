-- AlterTable
ALTER TABLE "service_jobs" ADD COLUMN     "invoice_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "service_jobs_invoice_id_key" ON "service_jobs"("invoice_id");

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
