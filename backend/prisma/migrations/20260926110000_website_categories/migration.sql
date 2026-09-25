-- AlterTable
ALTER TABLE "website_products" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "sub_category_id" TEXT;

-- CreateTable
CREATE TABLE "website_categories" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_categories_store_id_parent_id_idx" ON "website_categories"("store_id", "parent_id");

-- AddForeignKey
ALTER TABLE "website_categories" ADD CONSTRAINT "website_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_categories" ADD CONSTRAINT "website_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "website_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_products" ADD CONSTRAINT "website_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "website_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_products" ADD CONSTRAINT "website_products_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "website_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
