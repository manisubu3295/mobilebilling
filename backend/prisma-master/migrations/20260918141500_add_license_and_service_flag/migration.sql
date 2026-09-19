-- AlterTable
ALTER TABLE "platform_accounts" ADD COLUMN     "license_expires_at" TIMESTAMP(3),
ADD COLUMN     "service_module_enabled" BOOLEAN NOT NULL DEFAULT false;

