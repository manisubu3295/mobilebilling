-- Add RE spare parts columns to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "part_number" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compatible_models" TEXT;

-- Set default brand value for existing rows
ALTER TABLE "products" ALTER COLUMN "brand" SET DEFAULT 'Royal Enfield';

-- Drop old model column (replaced by compatible_models)
ALTER TABLE "products" DROP COLUMN IF EXISTS "model";

-- Add index on part_number
CREATE INDEX IF NOT EXISTS "products_part_number_idx" ON "products"("part_number");
