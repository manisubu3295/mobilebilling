-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "next_service_lookahead_days" INTEGER NOT NULL DEFAULT 30;
