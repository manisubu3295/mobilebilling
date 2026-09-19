-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
