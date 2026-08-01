-- Custom-field platform: admin-defined attributes for Product/Customer, replacing
-- hardcoded RE-specific columns over time. Additive only — no drops in this migration.

-- ── AttributeFieldType enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AttributeFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT', 'MULTISELECT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── attribute_definitions table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "attribute_definitions" (
  "id"         TEXT                 NOT NULL,
  "store_id"   TEXT                 NOT NULL,
  "entity_type" TEXT                NOT NULL,
  "key"        TEXT                 NOT NULL,
  "label"      TEXT                 NOT NULL,
  "field_type" "AttributeFieldType" NOT NULL,
  "options"    JSONB,
  "required"   BOOLEAN              NOT NULL DEFAULT false,
  "sort_order" INTEGER              NOT NULL DEFAULT 0,
  "is_active"  BOOLEAN              NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)         NOT NULL,

  CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "attribute_definitions_store_id_entity_type_key_key"
  ON "attribute_definitions"("store_id", "entity_type", "key");

CREATE INDEX IF NOT EXISTS "attribute_definitions_store_id_entity_type_idx"
  ON "attribute_definitions"("store_id", "entity_type");

DO $$ BEGIN
  ALTER TABLE "attribute_definitions"
    ADD CONSTRAINT "attribute_definitions_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── products / customers: add custom_fields JSONB ───────────────────────────
ALTER TABLE "products"  ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB;

CREATE INDEX IF NOT EXISTS "products_custom_fields_gin_idx"  ON "products"  USING GIN ("custom_fields");
CREATE INDEX IF NOT EXISTS "customers_custom_fields_gin_idx" ON "customers" USING GIN ("custom_fields");
