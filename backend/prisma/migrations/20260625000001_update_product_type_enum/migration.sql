-- Replace ProductType enum from mobile/laptop values to RE spare parts values

-- Step 1: drop the column constraint temporarily by casting to text
ALTER TABLE "products" ALTER COLUMN "type" TYPE TEXT;

-- Step 2: drop the old enum
DROP TYPE "ProductType";

-- Step 3: create the new enum with RE spare parts categories
CREATE TYPE "ProductType" AS ENUM (
  'ENGINE',
  'ELECTRICAL',
  'BODY_FRAME',
  'BRAKES_SUSPENSION',
  'FILTERS_FLUIDS',
  'CHAIN_SPROCKET',
  'TRANSMISSION',
  'ACCESSORIES',
  'OTHER'
);

-- Step 4: restore the column to use the new enum (existing rows default to OTHER)
UPDATE "products" SET "type" = 'OTHER' WHERE "type" NOT IN (
  'ENGINE','ELECTRICAL','BODY_FRAME','BRAKES_SUSPENSION',
  'FILTERS_FLUIDS','CHAIN_SPROCKET','TRANSMISSION','ACCESSORIES','OTHER'
);
ALTER TABLE "products" ALTER COLUMN "type" TYPE "ProductType" USING "type"::"ProductType";
