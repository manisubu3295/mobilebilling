'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchProduct, fetchProducts, WebsiteProduct } from '@/lib/site-api';
import { useCartStore } from '@/store/cart.store';
import { CartDrawer } from '@/components/CartDrawer';

const WHATSAPP = '918754816289';

function fmt(v: number) {
  return '₹' + v.toLocaleString('en-IN');
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<WebsiteProduct | null>(null);
  const [related, setRelated] = useState<WebsiteProduct[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [photo, setPhoto] = useState(0);
  const [added, setAdded] = useState(false);
  const add = useCartStore((s) => s.add);
  const openCart = useCartStore((s) => s.open);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPhoto(0);
    Promise.all([fetchProduct(id), fetchProducts()]).then(([p, all]) => {
      if (cancelled) return;
      if (!p) { setState('missing'); return; }
      setProduct(p);
      // Same sub-category first, then same category.
      const others = all.filter((o) => o.id !== p.id);
      const same = others.filter((o) => (p.subCategoryId ? o.subCategoryId === p.subCategoryId : o.category === p.category));
      const near = others.filter((o) => !same.includes(o) && o.category === p.category);
      setRelated([...same, ...near].slice(0, 4));
      setState('ready');
    });
    return () => { cancelled = true; };
  }, [id]);

  const header = (
    <header className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="wrap flex items-center justify-between py-3">
        <Link href="/products" className="text-sm font-medium" style={{ color: 'var(--brand)' }}>← All products</Link>
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
  );

  if (state !== 'ready' || !product) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        {header}
        <div className="wrap py-20 text-center text-gray-400">
          {state === 'loading' ? 'Loading…' : (
            <>This product is no longer listed. <Link href="/products" className="underline">See all products</Link></>
          )}
        </div>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [];
  const mrp = product.mrpPrice ? parseFloat(product.mrpPrice) : null;
  const selling = product.sellingPrice ? parseFloat(product.sellingPrice) : null;
  const discount = mrp && selling && mrp > selling ? Math.round((1 - selling / mrp) * 100) : null;
  const waText = `Hi, I'm interested in "${product.name}"${selling != null ? ` (${fmt(selling)})` : ''}. Please share details.`;

  const addToEnquiry = () => {
    add({ productId: product.id, name: product.name, category: product.category, sellingPrice: selling, image: images[0] || null });
    setAdded(true);
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {header}

      <div className="wrap py-6">
        {/* Breadcrumb */}
        <nav className="text-xs mb-4" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/products" className="hover:underline">Shop</Link>
          {' › '}{product.categoryRef?.name || product.category}
          {product.subCategory?.name && <>{' › '}{product.subCategory.name}</>}
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="aspect-square overflow-hidden border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', borderRadius: 'var(--radius-card)' }}>
              {images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[photo]} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: 'var(--ink-faint)' }}>Photo coming soon</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setPhoto(i)}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2"
                    style={{ borderColor: i === photo ? 'var(--brand)' : 'var(--border)' }}
                    aria-label={`Photo ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-3">
            {product.brand && (
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>{product.brand}</span>
            )}
            <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-sora), sans-serif', color: 'var(--ink)' }}>
              {product.name}
            </h1>
            {product.capacityLph && (
              <span className="w-fit text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-soft)', color: 'var(--brand)' }}>
                {product.capacityLph} LPH
              </span>
            )}

            <div className="mt-1">
              {selling != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>{fmt(selling)}</span>
                  {mrp && discount ? (
                    <>
                      <span className="line-through" style={{ color: 'var(--ink-faint)' }}>{fmt(mrp)}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--safe)' }}>{discount}% off</span>
                    </>
                  ) : null}
                </div>
              ) : (
                <span className="text-lg" style={{ color: 'var(--ink-muted)' }}>Price on enquiry</span>
              )}
            </div>

            {product.shortDescription && <p style={{ color: 'var(--ink-muted)' }}>{product.shortDescription}</p>}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={addToEnquiry}
                className="px-6 py-3 rounded-full text-sm font-semibold text-white"
                style={{ background: 'var(--brand)' }}
              >
                {added ? 'Added ✓' : 'Add to enquiry'}
              </button>
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(waText)}`}
                target="_blank" rel="noopener noreferrer"
                className="px-6 py-3 rounded-full text-sm font-semibold border"
                style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
              >
                WhatsApp us
              </a>
            </div>
            {added && (
              <button onClick={openCart} className="w-fit text-sm underline" style={{ color: 'var(--brand)' }}>View enquiry cart</button>
            )}

            {product.specSheetUrl && (
              <a href={product.specSheetUrl} target="_blank" rel="noopener noreferrer" className="w-fit text-sm underline" style={{ color: 'var(--fresh-glow)' }}>
                Download spec sheet (PDF)
              </a>
            )}

            {product.description && (
              <div className="mt-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <h2 className="mb-2 font-semibold" style={{ color: 'var(--ink)' }}>Details</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-semibold" style={{ color: 'var(--ink)' }}>You may also need</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {related.map((r) => {
                const price = r.sellingPrice ? parseFloat(r.sellingPrice) : null;
                return (
                  <Link
                    key={r.id}
                    href={`/products/${r.id}`}
                    className="bg-white border overflow-hidden hover:shadow-md transition-shadow"
                    style={{ borderColor: 'var(--border)', borderRadius: 'var(--radius-card)' }}
                  >
                    <div className="aspect-square" style={{ background: 'var(--bg-soft)' }}>
                      {r.images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.images[0]} alt={r.name} className="w-full h-full object-cover object-top" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{r.name}</p>
                      <p className="text-sm" style={{ color: 'var(--brand)' }}>{price != null ? fmt(price) : 'Price on enquiry'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <CartDrawer />
    </div>
  );
}
