'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cart.store';
import { PHONE_DISPLAY, PHONE_HREF } from '@/lib/site-contact';

const LINKS: Array<[string, string]> = [
  ['/products', 'Shop'],
  ['/#services', 'Services'],
  ['/#pricing', 'Pricing'],
  ['/#faq', 'FAQ'],
  ['/#contact', 'Contact'],
];

// The home page's header (same classes from globals.css), solid navy, for the
// React pages, with the quote list in place of the WhatsApp button.
export function SiteHeader() {
  const count = useQuoteCount();
  const openQuote = useCartStore((s) => s.open);

  return (
    <header className="site site--solid">
      <input type="checkbox" id="menu-toggle" className="menu-toggle-input" />
      <div className="wrap site-nav">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/images/logo-mark.png" alt="" width={32} height={32} />
          <span className="logo-word">H2O</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            {LINKS.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}
          </ul>
        </nav>
        <div className="nav-cta">
          <a className="nav-phone" href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          <button type="button" onClick={openQuote} className="quote-btn">
            Quote list
            {count > 0 && <span className="quote-count" aria-label={`${count} items`}>{count}</span>}
          </button>
          <label htmlFor="menu-toggle" className="menu-toggle" aria-label="Toggle menu">
            <span />
          </label>
        </div>
      </div>
      <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
        {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        <a className="btn btn-outline" href={PHONE_HREF}>Call {PHONE_DISPLAY}</a>
      </nav>
    </header>
  );
}

// Item count in the quote list. The list lives in localStorage, so it is only
// read after mount to keep the server and first client render identical.
export function useQuoteCount() {
  const count = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? count : 0;
}
