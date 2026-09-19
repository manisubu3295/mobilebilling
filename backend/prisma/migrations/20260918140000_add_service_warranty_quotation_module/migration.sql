-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceJobStatus" AS ENUM ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('OPEN', 'CONVERTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SERVICE_STAFF';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "gst_applied" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "requires_service" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "warranty_period_months" INTEGER,
    "service_frequency" "ServiceFrequency",
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "start_date" TIMESTAMP(3) NOT NULL,
    "next_service_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_jobs" (
    "id" TEXT NOT NULL,
    "warranty_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "assigned_to_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "status" "ServiceJobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visit_date" TIMESTAMP(3),
    "customer_feedback" TEXT,
    "staff_expense_amount" DECIMAL(10,2),
    "staff_expense_notes" TEXT,
    "customer_charge_amount" DECIMAL(10,2),
    "customer_charge_notes" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount_type" TEXT,
    "discount_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gst_applied" BOOLEAN NOT NULL DEFAULT true,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "valid_until" TIMESTAMP(3),
    "converted_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warranties_invoice_item_id_key" ON "warranties"("invoice_item_id");

-- CreateIndex
CREATE INDEX "warranties_store_id_status_idx" ON "warranties"("store_id", "status");

-- CreateIndex
CREATE INDEX "warranties_customer_id_idx" ON "warranties"("customer_id");

-- CreateIndex
CREATE INDEX "service_jobs_store_id_status_due_date_idx" ON "service_jobs"("store_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "service_jobs_assigned_to_id_status_idx" ON "service_jobs"("assigned_to_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotation_number_key" ON "quotations"("quotation_number");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_converted_invoice_id_key" ON "quotations"("converted_invoice_id");

-- CreateIndex
CREATE INDEX "quotations_store_id_status_idx" ON "quotations"("store_id", "status");

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_warranty_id_fkey" FOREIGN KEY ("warranty_id") REFERENCES "warranties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_invoice_id_fkey" FOREIGN KEY ("converted_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

