-- Genericize the domain model: drop RE-specific columns now that their values have
-- been backfilled into custom_fields (see backend/scripts/migrate-legacy-tenant.ts).
-- Note: the GIN indexes on custom_fields are intentionally left untouched — Prisma's
-- schema.prisma can't declare them, so `prisma migrate diff` wants to drop them, but
-- they're still needed by the attributes system.

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "re_model",
DROP COLUMN "vehicle_no";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "compatible_models",
DROP COLUMN "type",
ALTER COLUMN "brand" DROP NOT NULL,
ALTER COLUMN "brand" DROP DEFAULT;

-- DropEnum
DROP TYPE "ProductType";
