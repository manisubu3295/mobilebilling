-- CreateTable
CREATE TABLE "service_job_parts" (
    "id" TEXT NOT NULL,
    "service_job_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_job_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_job_parts_service_job_id_idx" ON "service_job_parts"("service_job_id");

-- AddForeignKey
ALTER TABLE "service_job_parts" ADD CONSTRAINT "service_job_parts_service_job_id_fkey" FOREIGN KEY ("service_job_id") REFERENCES "service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_parts" ADD CONSTRAINT "service_job_parts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_job_parts" ADD CONSTRAINT "service_job_parts_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
