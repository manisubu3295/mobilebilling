import { ADDRESS, GSTIN, PHONE_DISPLAY, PHONE_HREF } from '@/lib/site-contact';

// Same deep-navy footer as the home page.
export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-mark.png" alt="" width={22} height={22} style={{ display: 'block' }} />
            <span className="logo-word">H2O Water Care</span>
          </span>
          <span>&copy; {new Date().getFullYear()} H2O Water Care</span>
        </div>
        <div className="footer-contact">
          <span>{ADDRESS}</span>
          <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          <span style={{ fontSize: 12 }}>GSTIN: {GSTIN}</span>
        </div>
      </div>
      <div className="wrap footer-credit">
        <span>Website crafted by <a href="https://aadhiraiinnovations.com/" target="_blank" rel="noopener noreferrer">Aadhirai Innovations</a></span>
      </div>
    </footer>
  );
}
