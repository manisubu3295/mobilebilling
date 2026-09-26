import { ADDRESS, GSTIN, PHONE_DISPLAY, PHONE_HREF } from '@/lib/site-contact';

// The one site footer, shared by the home page and the shop pages.
export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <span className="footer-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-mark.png" alt="" width={22} height={22} />
            <span className="logo-word">H2O Water Care</span>
          </span>
          <span>&copy; {new Date().getFullYear()} H2O Water Care</span>
          <a className="footer-staff" href="https://billing.h2owaterpurifier.com/login" target="_blank" rel="noopener noreferrer">Staff Login</a>
        </div>
        <div className="footer-contact">
          <span>{ADDRESS}</span>
          <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          <span className="footer-gst">GSTIN: {GSTIN}</span>
        </div>
      </div>
      <div className="wrap footer-credit">
        <span>Website crafted by <a href="https://aadhiraiinnovations.com/" target="_blank" rel="noopener noreferrer">Aadhirai Innovations</a></span>
      </div>
    </footer>
  );
}
