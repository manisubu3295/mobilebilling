-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('SALES', 'SERVICE');

-- CreateEnum
CREATE TYPE "BillSeries" AS ENUM ('GST_SALES', 'SALES', 'SERVICE');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('WARRANTY', 'OUT_OF_WARRANTY', 'OTHER_SERVICE', 'IRF', 'AMC');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "warranty_card_terms" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "card_no" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "landmark" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "bill_fy" TEXT,
ADD COLUMN     "bill_no" TEXT,
ADD COLUMN     "bill_series" "BillSeries",
ADD COLUMN     "bill_type" "BillType" NOT NULL DEFAULT 'SALES',
ADD COLUMN     "service_category" "ServiceCategory",
ADD COLUMN     "tds_raw" TEXT,
ADD COLUMN     "tds_treated" TEXT,
ADD COLUMN     "technician_id" TEXT;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "warranties" ADD COLUMN     "amc_from" TIMESTAMP(3),
ADD COLUMN     "amc_to" TIMESTAMP(3),
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "card_date" TIMESTAMP(3),
ADD COLUMN     "hardness" TEXT,
ADD COLUMN     "installed_by" TEXT,
ADD COLUMN     "iron" TEXT,
ADD COLUMN     "media" TEXT,
ADD COLUMN     "membrane" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "other_impurities" TEXT,
ADD COLUMN     "power" TEXT,
ADD COLUMN     "pump" TEXT,
ADD COLUMN     "sold_by" TEXT,
ADD COLUMN     "tds" TEXT,
ADD COLUMN     "valve" TEXT,
ADD COLUMN     "vessel" TEXT;

-- CreateTable
CREATE TABLE "doc_sequences" (
    "store_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "doc_sequences_pkey" PRIMARY KEY ("store_id","key","fy")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_card_no_key" ON "customers"("card_no");

-- CreateIndex
CREATE INDEX "invoices_store_id_bill_type_idx" ON "invoices"("store_id", "bill_type");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_store_id_bill_series_bill_fy_bill_no_key" ON "invoices"("store_id", "bill_series", "bill_fy", "bill_no");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

