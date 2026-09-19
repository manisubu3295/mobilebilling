-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL';

-- Backfill: mark the auto-provisioned service-charge product correctly.
UPDATE "products" SET "type" = 'SERVICE' WHERE "name" = 'Service Visit Charge';
