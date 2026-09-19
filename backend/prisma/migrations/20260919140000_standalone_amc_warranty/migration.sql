-- DropForeignKey
ALTER TABLE "warranties" DROP CONSTRAINT "warranties_invoice_item_id_fkey";

-- AlterTable
ALTER TABLE "warranties" ALTER COLUMN "invoice_item_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
