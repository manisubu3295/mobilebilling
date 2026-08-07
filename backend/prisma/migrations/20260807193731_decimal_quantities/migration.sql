-- Weight/volume/length units (KG, LITER, METER) need to hold fractional
-- quantities; PCS/SET/PAIR stay whole numbers by convention, enforced at the
-- application layer (see backend/src/common/units.ts), not by the column type.
-- These casts are lossless: existing integer values convert exactly.

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,3),
ALTER COLUMN "returned_qty" SET DEFAULT 0,
ALTER COLUMN "returned_qty" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "skus" ALTER COLUMN "stock_qty" SET DEFAULT 0,
ALTER COLUMN "stock_qty" SET DATA TYPE DECIMAL(10,3);
