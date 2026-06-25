-- Full schema patch: align all tables from mobile/laptop to RE spare parts domain

-- ── skus table ────────────────────────────────────────────────────────────────
-- Add new RE spare parts columns
ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "unit"          TEXT    NOT NULL DEFAULT 'PCS';
ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "is_serialized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "skus" ADD COLUMN IF NOT EXISTS "stock_qty"     INTEGER NOT NULL DEFAULT 0;

-- Drop mobile/laptop-specific columns
ALTER TABLE "skus" DROP COLUMN IF EXISTS "storage";
ALTER TABLE "skus" DROP COLUMN IF EXISTS "color";
ALTER TABLE "skus" DROP COLUMN IF EXISTS "ram";

-- ── serial_inventory table ────────────────────────────────────────────────────
-- Add batch_number for lot/batch tracking
ALTER TABLE "serial_inventory" ADD COLUMN IF NOT EXISTS "batch_number" TEXT;

-- Drop IMEI unique indexes before dropping columns
DROP INDEX IF EXISTS "serial_inventory_imei1_key";
DROP INDEX IF EXISTS "serial_inventory_imei2_key";
DROP INDEX IF EXISTS "serial_inventory_imei1_idx";
DROP INDEX IF EXISTS "serial_inventory_imei2_idx";

-- Drop mobile-specific IMEI columns
ALTER TABLE "serial_inventory" DROP COLUMN IF EXISTS "imei1";
ALTER TABLE "serial_inventory" DROP COLUMN IF EXISTS "imei2";

-- ── customers table ───────────────────────────────────────────────────────────
-- Add Royal Enfield vehicle info fields
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "vehicle_no" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "re_model"   TEXT;

-- ── invoice_items table ───────────────────────────────────────────────────────
-- Add returned quantity tracking
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "returned_qty" INTEGER NOT NULL DEFAULT 0;
