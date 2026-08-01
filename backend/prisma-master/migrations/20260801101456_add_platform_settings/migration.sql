-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_pass" TEXT,
    "smtp_from" TEXT,
    "admin_notify_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
