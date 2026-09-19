-- Run this against the MASTER database — e.g.:
--   psql "$MASTER_DATABASE_URL" -f provision-tenant-admins-master-db.sql
--
-- Registers the h2o_db tenant so real login traffic can actually reach it.
-- Login resolves purely via email -> platform_user_emails -> platform_accounts
-- .tenant_db_url (see backend/src/auth/auth.service.ts login()) — never via
-- this backend's own DATABASE_URL env var, so this step is required even
-- though DATABASE_URL already points at h2o_db.
--
-- Fill in the two <...> placeholders below before running:
--   1. the real phone number for admin@h2owp.com (must be globally unique
--      across the whole platform)
--   2. the full Postgres connection string for h2o_db, exactly as it's set
--      as DATABASE_URL in backend/.env on the server

BEGIN;

INSERT INTO platform_accounts (
  id, business_name, owner_name, email, phone,
  tenant_db_name, tenant_db_url, status, service_module_enabled,
  created_at, updated_at
)
VALUES (
  md5(random()::text || clock_timestamp()::text),
  'H2O Water Care',
  'H2O Water Care Admin',
  'admin@h2owp.com',
  '+91XXXXXXXXXX',                                   -- <-- real phone number
  'h2o_db',
  '<postgresql://user:pass@host:5432/h2o_db>',       -- <-- real h2o_db connection string
  'ACTIVE',
  true,
  now(),
  now()
)
ON CONFLICT (tenant_db_name) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  owner_name    = EXCLUDED.owner_name,
  email         = EXCLUDED.email,
  phone         = EXCLUDED.phone,
  tenant_db_url = EXCLUDED.tenant_db_url,
  status        = 'ACTIVE',
  updated_at    = now();

INSERT INTO platform_user_emails (id, email, account_id, created_at)
SELECT md5(random()::text || clock_timestamp()::text), 'admin@h2owp.com', id, now()
FROM platform_accounts WHERE tenant_db_name = 'h2o_db'
ON CONFLICT (email) DO UPDATE SET account_id = EXCLUDED.account_id;

INSERT INTO platform_user_emails (id, email, account_id, created_at)
SELECT md5(random()::text || clock_timestamp()::text), 'admin@aistudio.com', id, now()
FROM platform_accounts WHERE tenant_db_name = 'h2o_db'
ON CONFLICT (email) DO UPDATE SET account_id = EXCLUDED.account_id;

COMMIT;
