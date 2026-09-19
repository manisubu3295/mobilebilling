-- AlterTable
ALTER TABLE "platform_accounts" ADD COLUMN     "site_key" TEXT,
ADD COLUMN     "website_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_site_key_key" ON "platform_accounts"("site_key");
