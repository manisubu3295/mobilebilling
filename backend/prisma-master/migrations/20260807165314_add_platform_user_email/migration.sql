-- CreateTable
CREATE TABLE "platform_user_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_user_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_emails_email_key" ON "platform_user_emails"("email");

-- CreateIndex
CREATE INDEX "platform_user_emails_account_id_idx" ON "platform_user_emails"("account_id");

-- AddForeignKey
ALTER TABLE "platform_user_emails" ADD CONSTRAINT "platform_user_emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
