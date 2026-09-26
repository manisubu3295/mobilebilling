'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/cart.store';
import { PHONE_DISPLAY, PHONE_HREF, waLink } from '@/lib/site-contact';

const STAFF_LOGIN = 'https://billing.h2owaterpurifier.com/login';
const WHATSAPP_TEST = waLink("Hi, I'd like to book a free water test");

// Home page sections; other pages link back to them.
const SECTIONS: Array<[string, string]> = [
  ['about', 'About'],
  ['services', 'Services'],
  ['pricing', 'Pricing'],
  ['why', 'Why Us'],
  ['process', 'Process'],
  ['faq', 'FAQ'],
  ['contact', 'Contact'],
];

// The one site header, used by the home page and the shop pages so they stay
// identical: solid navy everywhere. Only the main button differs — WhatsApp on
// the home page, the quote list on shop pages.
export function SiteHeader({ variant = 'page' }: { variant?: 'home' | 'page' }) {
  const home = variant === 'home';
  const count = useQuoteCount();
  const openQuote = useCartStore((s) => s.open);
  const links: Array<[string, string]> = [
    ['/products', 'Shop'],
    ...SECTIONS.map(([id, label]) => [home ? `#${id}` : `/#${id}`, label] as [string, string]),
  ];

  return (
    <header className="site site--solid">
      <input type="checkbox" id="menu-toggle" className="menu-toggle-input" />
      <div className="wrap site-nav">
        <a href={home ? '#home' : '/'} className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-mark" src="/images/logo-mark.png" alt="" width={32} height={32} />
          <span className="logo-word">H2O</span>
        </a>
        <nav>
          <ul className="nav-links">
            {links.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}
          </ul>
        </nav>
        <div className="nav-cta">
          <a className="staff-login" href={STAFF_LOGIN} target="_blank" rel="noopener noreferrer">Staff Login</a>
          <a className="nav-phone" href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          {home ? (
            <a className="btn btn-primary" href={WHATSAPP_TEST} target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
          ) : (
            <button type="button" className="btn btn-primary" onClick={openQuote}>
              Quote list
              {count > 0 && <span className="quote-count" aria-label={`${count} items`}>{count}</span>}
            </button>
          )}
          <label htmlFor="menu-toggle" className="menu-toggle" aria-label="Toggle menu">
            <span />
          </label>
        </div>
      </div>
      <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
        {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        <a href={STAFF_LOGIN} target="_blank" rel="noopener noreferrer">Staff Login</a>
        <a className="btn btn-primary" href={WHATSAPP_TEST} target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
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
