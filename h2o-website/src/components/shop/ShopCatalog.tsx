'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CatalogCategory, WebsiteProduct } from '@/lib/site-api';
import { useCartStore } from '@/store/cart.store';
import { useQuoteCount } from '@/components/SiteHeader';
import { PHONE_DISPLAY, PHONE_HREF, waLink } from '@/lib/site-contact';
import { NEEDS, fitsNeed } from './needs';
import { ProductCard, WhatsAppIcon } from './ProductCard';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';
const SORTS: Array<[SortKey, string]> = [
  ['featured', 'Featured'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['name', 'Name'],
];

const priceOf = (p: WebsiteProduct) => (p.sellingPrice ? parseFloat(p.sellingPrice) : null);

// The whole shop below the header. Every filter lives in the URL
// (?need=&cat=&sub=&type=&brand=&sort=&q=) so a filtered view can be shared on
// WhatsApp and the Back button steps back through choices.
export function ShopCatalog({ products, tree }: { products: WebsiteProduct[]; tree: CatalogCategory[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const need = NEEDS.find((n) => n.key === params.get('need')) ?? null;
  const cat = params.get('cat');
  const sub = params.get('sub');
  const type = params.get('type'); // plain category name, for stores without a category tree
  const brand = params.get('brand');
  const sort = (SORTS.find(([k]) => k === params.get('sort'))?.[0] ?? 'featured') as SortKey;
  const q = params.get('q') ?? '';

  const [query, setQuery] = useState(q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => setQuery(q), [q]);

  // On phones the strip scrolls sideways; bring the chosen need into view
  // (e.g. when a shared ?need=factory link opens).
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('.need.is-active');
    if (strip && active && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = active.offsetLeft - strip.offsetLeft - 20;
    }
  }, [need?.key]);

  // push = a choice worth a Back step; replace = typing / re-sorting.
  const go = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    const qs = next.toString();
    router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => go({ q: query.trim() || null }, 'replace'), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const flatNames = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  // Category first, then need (so need counts reflect the chosen category).
  const inCategory = useMemo(() => products.filter((p) => {
    if (cat && p.categoryId !== cat) return false;
    if (sub && p.subCategoryId !== sub) return false;
    if (type && p.category !== type) return false;
    return true;
  }), [products, cat, sub, type]);

  const needCounts = useMemo(
    () => Object.fromEntries(NEEDS.map((n) => [n.key, inCategory.filter((p) => fitsNeed(p, n)).length])),
    [inCategory],
  );
  const showNeeds = products.some((p) => p.capacityLph != null);

  const inNeed = useMemo(() => (need ? inCategory.filter((p) => fitsNeed(p, need)) : inCategory), [inCategory, need]);

  const brands = useMemo(
    () => Array.from(new Set(inNeed.map((p) => p.brand).filter(Boolean))).sort() as string[],
    [inNeed],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = inNeed.filter((p) => {
      if (brand && p.brand !== brand) return false;
      if (!term) return true;
      return [p.name, p.shortDescription, p.brand, p.category, p.capacityLph ? `${p.capacityLph} lph` : null]
        .some((v) => v?.toLowerCase().includes(term));
    });
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price-asc' || sort === 'price-desc') {
      const dir = sort === 'price-asc' ? 1 : -1;
      // Price-on-request items always go last.
      return [...list].sort((a, b) => {
        const pa = priceOf(a); const pb = priceOf(b);
        if (pa == null) return pb == null ? 0 : 1;
        if (pb == null) return -1;
        return (pa - pb) * dir;
      });
    }
    return list;
  }, [inNeed, brand, q, sort]);

  const catName = useMemo(() => {
    if (type) return type;
    const c = tree.find((x) => x.id === cat);
    const s = c?.children.find((x) => x.id === sub);
    return s ? s.name : c?.name ?? null;
  }, [tree, cat, sub, type]);

  const filtered = !!(need || cat || type || brand || q);
  const pickCategory = (patch: Record<string, string | null>) => { go({ cat: null, sub: null, type: null, brand: null, ...patch }); setSheetOpen(false); };

  const categoryNav = (
    <CategoryNav tree={tree} flatNames={flatNames} cat={cat} sub={sub} type={type} onPick={pickCategory} />
  );

  return (
    <div className="shop-page">
      <div className="wrap shop-head">
        <div className="shop-title">
          <h1>Water purifiers &amp; RO plants</h1>
          <p>
            Choose by how much water you need. We confirm the right model after a free water test, then install and
            service it from our shop in Kumbakonam.
          </p>
        </div>
        <label className="shop-search">
          <span className="sr-only">Search products</span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, brand or LPH"
          />
        </label>
      </div>

      {showNeeds && (
        <div className="wrap">
          <div ref={stripRef} className="need-strip" role="group" aria-label="What do you need it for?">
            {NEEDS.map((n) => {
              const active = need?.key === n.key;
              const count = needCounts[n.key];
              return (
                <button
                  key={n.key}
                  type="button"
                  aria-pressed={active}
                  disabled={!count && !active}
                  onClick={() => go({ need: active ? null : n.key, brand: null })}
                  className={`need${active ? ' is-active' : ''}`}
                  style={{ ['--level' as string]: `${n.level}%` }}
                >
                  <span className="need-label">{n.label}</span>
                  <span className="need-range">{n.range}</span>
                  <span className="need-count">{count ? `${count} system${count === 1 ? '' : 's'}` : 'None listed yet'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="wrap shop-layout">
        <aside className="shop-side" aria-label="Categories">{categoryNav}</aside>

        <div className="shop-main">
          <div className="shop-toolbar">
            <button type="button" className="shop-cat-btn" onClick={() => setSheetOpen(true)}>
              {catName ?? 'All categories'}
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <p className="shop-count" aria-live="polite">
              {visible.length} {visible.length === 1 ? 'system' : 'systems'}
              {catName && <> in {catName}</>}
              {need && <> for {need.label.toLowerCase()}</>}
              {filtered && (
                <button type="button" className="shop-clear" onClick={() => go({ need: null, cat: null, sub: null, type: null, brand: null, q: null })}>
                  Clear filters
                </button>
              )}
            </p>
            <label className="shop-sort">
              Sort
              <select value={sort} onChange={(e) => go({ sort: e.target.value === 'featured' ? null : e.target.value }, 'replace')}>
                {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          {brands.length > 1 && (
            <div className="brand-chips" role="group" aria-label="Brand">
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={brand === b}
                  className={`chip${brand === b ? ' is-active' : ''}`}
                  onClick={() => go({ brand: brand === b ? null : b })}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="shop-empty">
              <h2>No systems match these filters</h2>
              <p>Tell us what you need and we&apos;ll suggest the right system — or clear the filters to see everything.</p>
              <div className="shop-empty-actions">
                <button type="button" className="btn-quote" onClick={() => go({ need: null, cat: null, sub: null, type: null, brand: null, q: null })}>Clear filters</button>
                <a className="btn-line" href={PHONE_HREF}>Call {PHONE_DISPLAY}</a>
              </div>
            </div>
          ) : (
            <div className="product-grid">
              {visible.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}

          <div className="shop-advice">
            <div>
              <h2>Not sure which system fits?</h2>
              <p>We test your water for free — hardness, TDS and iron — and suggest the model and capacity that suits it.</p>
            </div>
            <div className="shop-advice-actions">
              <a className="btn btn-primary" href={waLink("Hi, I'd like to book a free water test")} target="_blank" rel="noopener noreferrer">
                Book a free water test
              </a>
              <a className="btn btn-ghost" href={PHONE_HREF}>Call {PHONE_DISPLAY}</a>
            </div>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="cat-sheet" role="dialog" aria-modal="true" aria-label="Categories">
          <div className="cat-sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="cat-sheet-panel">
            <div className="cat-sheet-head">
              <span>Categories</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close">&times;</button>
            </div>
            {categoryNav}
          </div>
        </div>
      )}

      <ShopBar />
    </div>
  );
}

function CategoryNav({ tree, flatNames, cat, sub, type, onPick }: {
  tree: CatalogCategory[]; flatNames: string[]; cat: string | null; sub: string | null; type: string | null;
  onPick: (patch: Record<string, string | null>) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const all = !cat && !type;

  return (
    <nav className="cat-nav">
      <button type="button" className={`cat-item${all ? ' is-active' : ''}`} aria-current={all || undefined} onClick={() => onPick({})}>
        All products
      </button>
      {tree.length > 0
        ? tree.map((c) => {
            const catActive = cat === c.id;
            const open = expanded[c.id] ?? catActive;
            return (
              <div key={c.id} className="cat-group">
                <div className="cat-row">
                  <button
                    type="button"
                    className={`cat-item${catActive && !sub ? ' is-active' : ''}`}
                    aria-current={(catActive && !sub) || undefined}
                    onClick={() => onPick({ cat: c.id })}
                  >
                    {c.name}
                  </button>
                  {c.children.length > 0 && (
                    <button
                      type="button"
                      className="cat-toggle"
                      aria-expanded={open}
                      aria-label={open ? `Hide ${c.name} types` : `Show ${c.name} types`}
                      onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))}
                    >
                      {open ? '−' : '+'}
                    </button>
                  )}
                </div>
                {open && c.children.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`cat-item cat-sub${catActive && sub === s.id ? ' is-active' : ''}`}
                    aria-current={(catActive && sub === s.id) || undefined}
                    onClick={() => onPick({ cat: c.id, sub: s.id })}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            );
          })
        : flatNames.map((name) => (
            <button
              key={name}
              type="button"
              className={`cat-item${type === name ? ' is-active' : ''}`}
              aria-current={type === name || undefined}
              onClick={() => onPick({ type: name })}
            >
              {name}
            </button>
          ))}
    </nav>
  );
}

// Phone-width bar: the quote list and WhatsApp always one tap away.
export function ShopBar() {
  const count = useQuoteCount();
  const openQuote = useCartStore((s) => s.open);
  return (
    <div className="shop-bar">
      <button type="button" className="shop-bar-quote" onClick={openQuote}>
        Quote list{count > 0 ? ` (${count})` : ''}
      </button>
      <a className="shop-bar-wa" href={waLink("Hi, I'd like help choosing a water purifier")} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon /> WhatsApp
      </a>
    </div>
  );
}
