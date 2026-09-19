'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchProducts, WebsiteProduct } from '@/lib/site-api';
import { useCartStore } from '@/store/cart.store';
import { CartDrawer } from '@/components/CartDrawer';

function fmt(v: string | null) {
  if (!v) return null;
  return '₹' + parseFloat(v).toLocaleString('en-IN');
}

function ProductCard({ product }: { product: WebsiteProduct }) {
  const add = useCartStore((s) => s.add);
  const image = product.images?.[0] || null;
  const mrp = product.mrpPrice ? parseFloat(product.mrpPrice) : null;
  const selling = product.sellingPrice ? parseFloat(product.sellingPrice) : null;
  const discount = mrp && selling && mrp > selling ? Math.round((1 - selling / mrp) * 100) : null;

  return (
    <div
      className="bg-white border flex flex-col overflow-hidden"
      style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-card)' }}
    >
      {/* Square tile, cropped from the top — these are real phone photos from
          installs (portrait wall units, boxier plant equipment), and a square
          top-anchored crop is the one ratio that keeps the unit itself in
          frame across both without stretching or overriding the ratio via a
          flex min-height quirk (hence min-h-0 below). */}
      <div className="aspect-square relative min-h-0 shrink-0" style={{ background: 'var(--bg-soft)' }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: 'var(--ink-faint)' }}>
            Photo coming soon
          </div>
        )}
        {image && (
          <div
            className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 text-[11px] font-medium text-white"
            style={{ background: 'linear-gradient(to top, rgba(11,31,110,0.65), transparent)' }}
          >
            Real install &middot; Kumbakonam
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug" style={{ fontFamily: 'var(--font-sora), sans-serif', color: 'var(--ink)' }}>
            {product.name}
          </h3>
          {product.capacityLph && (
            <span
              className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-soft)', color: 'var(--brand)' }}
            >
              {product.capacityLph} LPH
            </span>
          )}
        </div>

        {product.shortDescription && (
          <p className="text-sm line-clamp-2" style={{ color: 'var(--ink-muted)' }}>{product.shortDescription}</p>
        )}

        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div>
            {selling != null ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-lg" style={{ color: 'var(--brand)' }}>{fmt(product.sellingPrice)}</span>
                  {mrp && discount ? <span className="text-xs line-through" style={{ color: 'var(--ink-faint)' }}>{fmt(product.mrpPrice)}</span> : null}
                </div>
                {discount ? <span className="text-xs font-semibold" style={{ color: 'var(--safe)' }}>{discount}% off</span> : null}
              </>
            ) : (
              <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>Price on enquiry</span>
            )}
            {product.specSheetUrl && (
              <a href={product.specSheetUrl} target="_blank" rel="noopener noreferrer" className="block text-xs underline mt-1" style={{ color: 'var(--fresh-glow)' }}>
                Spec sheet (PDF)
              </a>
            )}
          </div>
          <button
            onClick={() => add({ productId: product.id, name: product.name, category: product.category, sellingPrice: selling, image })}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ background: 'var(--brand)' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const openCart = useCartStore((s) => s.open);

  useEffect(() => {
    fetchProducts()
      .then((data) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const visible = activeCategory === 'All' ? products : products.filter((p) => p.category === activeCategory);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <header className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="wrap flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--brand)' }}>
            <span style={{ fontFamily: 'var(--font-sora), sans-serif' }}>H2O</span>
          </Link>
          <h1 className="font-semibold hidden sm:block" style={{ color: 'var(--ink)' }}>Shop</h1>
          <button onClick={openCart} className="relative flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="wrap pt-6">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Priced systems and plants, sized for Kumbakonam water — add what you need and send it to us for a firm quote.
        </p>
      </div>

      <div className="wrap py-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        <aside>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-400">Categories</h2>
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap ${activeCategory === cat ? 'font-semibold' : 'text-gray-600'}`}
                style={activeCategory === cat ? { background: 'var(--bg-soft)', color: 'var(--brand)' } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        <main>
          {loading ? (
            <div className="text-gray-400 py-20 text-center">Loading products…</div>
          ) : visible.length === 0 ? (
            <div className="text-gray-400 py-20 text-center">
              No products here yet — call us on <a href="tel:+918754816289" className="underline">+91 87548 16289</a> and we'll help directly.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visible.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </main>
      </div>

      <CartDrawer />
    </div>
  );
}
