import { Suspense } from 'react';
import { CatalogCategory, fetchCategories, fetchProducts, WebsiteProduct } from '@/lib/site-api';
import { SITE_URL } from '@/lib/site-contact';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CartDrawer } from '@/components/CartDrawer';
import { ShopCatalog } from '@/components/shop/ShopCatalog';

// Rendered on the server so product names, capacities and prices are in the
// HTML search engines read (metadata lives in ./layout.tsx). Filtering then
// runs in the browser over the same list.
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const [products, tree] = await Promise.all([
    fetchProducts().catch((): WebsiteProduct[] => []),
    fetchCategories().catch((): CatalogCategory[] => []),
  ]);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Water purifiers and RO plants — H2O Water Care, Kumbakonam',
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/products/${p.id}`,
      item: {
        '@type': 'Product',
        name: p.name,
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
        ...(p.shortDescription ? { description: p.shortDescription } : {}),
        ...(p.images?.[0]?.startsWith('http') ? { image: p.images[0] } : {}),
        ...(p.sellingPrice
          ? { offers: { '@type': 'Offer', price: parseFloat(p.sellingPrice), priceCurrency: 'INR', availability: 'https://schema.org/InStock' } }
          : {}),
      },
    })),
  };

  return (
    <>
      <SiteHeader />
      <main>
        <Suspense fallback={null}>
          <ShopCatalog products={products} tree={tree} />
        </Suspense>
      </main>
      <SiteFooter />
      <CartDrawer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, '\\u003c') }} />
    </>
  );
}
