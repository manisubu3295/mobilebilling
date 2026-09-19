-- Run this against the TENANT database (h2o_db) — e.g.:
--   psql "postgresql://user:pass@host:5432/h2o_db" -f provision-tenant-admins-tenant-db.sql
--
-- Wipes all business data except the Store config row, then inserts two
-- SUPER_ADMIN users. Passwords are already argon2id-hashed below (the app
-- verifies logins with argon2.verify, which reads params from the hash
-- itself, so these are portable regardless of the server's OS/CPU).
--
-- Plaintext passwords (save these now, they appear nowhere else):
--   admin@h2owp.com     / AgoQCxNpP7SUcH5L90
--   admin@aistudio.com  / GyEbwKjc5F3GbqDI94
--
-- IRREVERSIBLE — confirm the `stores` row already has the correct business
-- name/address/GST/phone before running.

BEGIN;

DELETE FROM notifications;
DELETE FROM service_job_parts;
DELETE FROM service_jobs;
DELETE FROM warranties;
DELETE FROM quotation_items;
DELETE FROM quotations;
DELETE FROM payments;
DELETE FROM serial_inventory;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM refresh_tokens;
DELETE FROM audit_logs;
DELETE FROM users;
DELETE FROM skus;
DELETE FROM products;
DELETE FROM attribute_definitions;
DELETE FROM customers;
DELETE FROM suppliers;
DELETE FROM categories;

INSERT INTO users (id, email, phone, password_hash, name, role, is_active, store_id, created_at, updated_at)
VALUES (
  md5(random()::text || clock_timestamp()::text),
  'admin@h2owp.com',
  '+91XXXXXXXXXX',                       -- <-- fill in a real phone number before running
  '$argon2id$v=19$m=65536,t=3,p=4$P20BMDhninB2wifG1/G01A$yahalqblJnaVAgrmH9ywTJtVBziAhpm1k8z+NiVBl+g',
  'H2O Water Care Admin',
  'SUPER_ADMIN',
  true,
  (SELECT id FROM stores LIMIT 1),
  now(),
  now()
);

INSERT INTO users (id, email, phone, password_hash, name, role, is_active, store_id, created_at, updated_at)
VALUES (
  md5(random()::text || clock_timestamp()::text),
  'admin@aistudio.com',
  NULL,
  '$argon2id$v=19$m=65536,t=3,p=4$Wk+pgjLFYIfc48w6dFpjnA$NlOV4kViWMnyrxz5bytW5Pnhi54sTF8Nt2K+SyI/sC0',
  'IT Support',
  'SUPER_ADMIN',
  true,
  (SELECT id FROM stores LIMIT 1),
  now(),
  now()
);

COMMIT;
