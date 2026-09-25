'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CatalogCategory, fetchCategories, fetchProducts, WebsiteProduct } from '@/lib/site-api';
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
      <Link href={`/products/${product.id}`} className="block aspect-square relative min-h-0 shrink-0" style={{ background: 'var(--bg-soft)' }}>
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
      </Link>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug" style={{ fontFamily: 'var(--font-sora), sans-serif', color: 'var(--ink)' }}>
            <Link href={`/products/${product.id}`} className="hover:underline">{product.name}</Link>
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

        {product.brand && (
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>{product.brand}</span>
        )}

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

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

// What the shopper has drilled into: everything, a top category (optionally
// one of its sub-categories), or — for stores without a category tree — one
// of the plain category names.
type Selection =
  | { kind: 'all' }
  | { kind: 'tree'; categoryId: string; subCategoryId?: string }
  | { kind: 'name'; name: string };

const priceOf = (p: WebsiteProduct) => (p.sellingPrice ? parseFloat(p.sellingPrice) : null);

function CategoryTree({
  tree, flatNames, selection, onSelect,
}: {
  tree: CatalogCategory[];
  flatNames: string[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isAll = selection.kind === 'all';
  const activeSub = selection.kind === 'tree' ? selection.subCategoryId : undefined;
  const itemStyle = (active: boolean) => (active ? { background: 'var(--bg-soft)', color: 'var(--brand)' } : undefined);

  return (
    <nav className="flex flex-col">
      <button
        onClick={() => onSelect({ kind: 'all' })}
        className={`text-left text-sm px-3 py-2.5 rounded-lg ${isAll ? 'font-semibold' : 'text-gray-700'}`}
        style={itemStyle(isAll)}
      >
        All products
      </button>

      {tree.length > 0
        ? tree.map((cat) => {
            const catActive = selection.kind === 'tree' && selection.categoryId === cat.id;
            const open = expanded[cat.id] ?? catActive;
            return (
              <div key={cat.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center">
                  <button
                    onClick={() => onSelect({ kind: 'tree', categoryId: cat.id })}
                    className={`flex-1 text-left text-sm px-3 py-2.5 rounded-lg ${catActive && !activeSub ? 'font-semibold' : 'text-gray-800'}`}
                    style={itemStyle(catActive && !activeSub)}
                  >
                    {cat.name}
                  </button>
                  {cat.children.length > 0 && (
                    <button
                      aria-label={open ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
                      onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !open }))}
                      className="px-3 py-2 text-lg leading-none"
                      style={{ color: 'var(--ink-faint)' }}
                    >
                      {open ? '−' : '+'}
                    </button>
                  )}
                </div>
                {open && cat.children.length > 0 && (
                  <div className="pb-1">
                    {cat.children.map((sub) => {
                      const subActive = catActive && activeSub === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onSelect({ kind: 'tree', categoryId: cat.id, subCategoryId: sub.id })}
                          className={`block w-full text-left text-[13px] pl-7 pr-3 py-2 rounded-lg uppercase tracking-wide ${subActive ? 'font-semibold' : 'text-gray-600'}`}
                          style={itemStyle(subActive)}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        : flatNames.map((name) => {
            const active = selection.kind === 'name' && selection.name === name;
            return (
              <button
                key={name}
                onClick={() => onSelect({ kind: 'name', name })}
                className={`text-left text-sm px-3 py-2.5 rounded-lg border-t ${active ? 'font-semibold' : 'text-gray-700'}`}
                style={{ borderColor: 'var(--border)', ...itemStyle(active) }}
              >
                {name}
              </button>
            );
          })}
    </nav>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const [brand, setBrand] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const openCart = useCartStore((s) => s.open);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([p, c]) => { setProducts(p); setTree(c); })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const flatNames = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const inSelection = useMemo(() => products.filter((p) => {
    if (selection.kind === 'tree') {
      if (p.categoryId !== selection.categoryId) return false;
      if (selection.subCategoryId && p.subCategoryId !== selection.subCategoryId) return false;
    }
    if (selection.kind === 'name' && p.category !== selection.name) return false;
    return true;
  }), [products, selection]);

  const brands = useMemo(
    () => Array.from(new Set(inSelection.map((p) => p.brand).filter(Boolean))).sort() as string[],
    [inSelection],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inSelection.filter((p) => {
      if (brand && p.brand !== brand) return false;
      if (!q) return true;
      return [p.name, p.shortDescription, p.brand, p.category].some((v) => v?.toLowerCase().includes(q));
    });
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price-asc' || sort === 'price-desc') {
      const dir = sort === 'price-asc' ? 1 : -1;
      // Price-on-enquiry items always go last.
      return [...list].sort((a, b) => {
        const pa = priceOf(a); const pb = priceOf(b);
        if (pa == null) return pb == null ? 0 : 1;
        if (pb == null) return -1;
        return (pa - pb) * dir;
      });
    }
    return list;
  }, [inSelection, brand, query, sort]);

  const heading = useMemo(() => {
    if (selection.kind === 'name') return selection.name;
    if (selection.kind === 'tree') {
      const cat = tree.find((c) => c.id === selection.categoryId);
      const sub = cat?.children.find((c) => c.id === selection.subCategoryId);
      return sub ? `${cat?.name} · ${sub.name}` : cat?.name || 'Products';
    }
    return 'All products';
  }, [selection, tree]);

  const select = (s: Selection) => { setSelection(s); setBrand(null); setMenuOpen(false); };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <header className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="wrap flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden flex flex-col justify-center gap-1 w-9 h-9 items-center rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
              aria-label="Open categories"
            >
              <span className="block w-4 h-0.5" style={{ background: 'var(--ink)' }} />
              <span className="block w-4 h-0.5" style={{ background: 'var(--ink)' }} />
              <span className="block w-4 h-0.5" style={{ background: 'var(--ink)' }} />
            </button>
            <Link href="/" className="flex items-center gap-2 font-extrabold" style={{ color: 'var(--brand)' }}>
              <span style={{ fontFamily: 'var(--font-sora), sans-serif' }}>H2O</span>
            </Link>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands…"
            className="flex-1 max-w-md min-w-0 border rounded-full px-4 py-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
          <button onClick={openCart} className="relative flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium shrink-0" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ background: 'var(--brand)' }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile category drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs bg-white overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 text-white" style={{ background: 'var(--brand)' }}>
              <span className="font-semibold">Shop by category</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close" className="text-2xl leading-none">&times;</button>
            </div>
            <div className="p-2">
              <CategoryTree tree={tree} flatNames={flatNames} selection={selection} onSelect={select} />
            </div>
          </div>
        </div>
      )}

      <div className="wrap py-6 grid grid-cols-1 md:grid-cols-[230px_1fr] gap-8">
        <aside className="hidden md:block">
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-400">Categories</h2>
          <CategoryTree tree={tree} flatNames={flatNames} selection={selection} onSelect={select} />
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-sora), sans-serif' }}>{heading}</h1>
              {!loading && (
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                  Showing {visible.length} result{visible.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>

          {brands.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-400">Brands</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBrand(brand === b ? null : b)}
                    className="px-4 py-2 rounded-xl border text-sm font-semibold"
                    style={brand === b
                      ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                      : { borderColor: 'var(--border)', color: 'var(--ink)', background: '#fff' }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400 py-20 text-center">Loading products…</div>
          ) : visible.length === 0 ? (
            <div className="text-gray-400 py-20 text-center">
              No products here yet — call us on <a href="tel:+918754816289" className="underline">+91 87548 16289</a> and we&apos;ll help directly.
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
