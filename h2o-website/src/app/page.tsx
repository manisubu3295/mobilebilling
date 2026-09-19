'use client';

import { useEffect } from 'react';

// Ported from the H2O landing page artifact. The markup is static and
// author-controlled (no user input), so dangerouslySetInnerHTML is the
// pragmatic way to bring it in 1:1 without hand-converting every kebab-case
// SVG attribute and inline style string to JSX -- a large, error-prone job
// for content that never needs React state or interactivity.
export default function Home() {
  useEffect(() => {
    // Mobile Safari (and some Android WebViews) don't reliably honour the
    // `muted` HTML *attribute* on a <video> that was inserted via innerHTML
    // rather than present in the originally-parsed document -- it needs the
    // `.muted` *property* set in JS, or autoplay silently falls back to a
    // paused video with a play button, which is exactly what this fixes.
    const video = document.querySelector<HTMLVideoElement>('.hero-bg video');
    if (video) {
      video.muted = true;
      video.play().catch(() => {
        // Still blocked (e.g. Low Power Mode) -- the poster image and
        // native play button are an acceptable fallback in that case.
      });
    }
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: pageHtml }} />;
}

const pageHtml = `
<header class="site">
  <input type="checkbox" id="menu-toggle" class="menu-toggle-input" />
  <div class="wrap site-nav">
    <a href="#home" class="logo">
      <svg class="logo-mark" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="15" fill="var(--fresh)" opacity="0.16"/>
        <path d="M16 5C16 5 8 15.5 8 20.5C8 25.2 11.6 28 16 28C20.4 28 24 25.2 24 20.5C24 15.5 16 5 16 5Z" fill="var(--brand)"/>
        <path d="M12.5 21.5C12.5 23.5 14 24.8 16 24.8" stroke="var(--fresh-glow)" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <span class="logo-word">H2O</span>
    </a>
    <nav>
      <ul class="nav-links">
        <li><a href="/products">Shop</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#why">Why Us</a></li>
        <li><a href="#process">Process</a></li>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="nav-cta">
      <a class="staff-login" href="https://billing.h2owaterpurifier.com/login" target="_blank" rel="noopener noreferrer">Staff Login</a>
      <a class="nav-phone" href="tel:+918754816289">+91 87548 16289</a>
      <a class="btn btn-outline" href="tel:+918754816289">Call Now</a>
      <label for="menu-toggle" class="menu-toggle" aria-label="Toggle menu">
        <span></span>
      </label>
    </div>
  </div>
  <nav id="mobile-nav" class="mobile-nav" aria-label="Mobile">
    <a href="/products">Shop</a>
    <a href="#about">About</a>
    <a href="#services">Services</a>
    <a href="#pricing">Pricing</a>
    <a href="#why">Why Us</a>
    <a href="#process">Process</a>
    <a href="#faq">FAQ</a>
    <a href="#contact">Contact</a>
    <a href="https://billing.h2owaterpurifier.com/login" target="_blank" rel="noopener noreferrer">Staff Login</a>
    <a class="btn btn-primary" href="tel:+918754816289">Call +91 87548 16289</a>
    <a class="btn btn-outline" href="https://wa.me/918754816289?text=Hi%2C%20I%27d%20like%20to%20book%20a%20free%20water%20test" target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
  </nav>
</header>

<section id="home" class="hero">
  <div class="hero-bg" aria-hidden="true">
    <video autoplay muted loop playsinline preload="auto" poster="/images/hero-bg-poster.jpg">
      <source src="/videos/hero-bg.mp4" type="video/mp4" />
    </video>
  </div>
  <div class="wrap">
    <div class="hero-grid">
      <h1>Kumbakonam's water,<br>engineered pure.</h1>
      <p class="lede">H2O is Kumbakonam's water filter supplier — sales and service for every type of water filter and purifier, RO, UV, UF and softeners, for homes across the city, from raw water at the tap to a glass you don't have to think twice about.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="tel:+918754816289">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" fill="currentColor"/></svg>
          Call Now
        </a>
        <a class="btn btn-ghost" href="https://wa.me/918754816289?text=Hi%2C%20I%27d%20like%20to%20book%20a%20free%20water%20test" target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.5.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.6-1.9-.1-.2 0-.4.1-.5.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1 0 1.2.9 2.4 1 2.6.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.2-.2-.5-.3Z" fill="currentColor"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Z" fill="currentColor"/></svg>
          WhatsApp Us
        </a>
      </div>
      <div class="hero-meta">
        <span>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5C19 5.9 15.9 3 12 3S5 5.9 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>
          No. 38/1077, Bakkiyanathan Street, Thanjavur Main Road, Kumbakonam
        </span>
        <span>
          <svg viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" stroke="currentColor" stroke-width="1.6"/></svg>
          +91 87548 16289
        </span>
      </div>
    </div>

    <div class="journey">
      <div class="journey-card">
        <div class="stages">
          <div class="stage">
            <div class="stage-dot" style="background:color-mix(in srgb, var(--turbid) 32%, #0b1f6e)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16M4 7h16M4 17h16" stroke="var(--turbid)" stroke-width="1.8" stroke-linecap="round"/></svg>
            </div>
            <p class="stage-name">Raw&nbsp;water</p>
            <p class="stage-tds" style="color:color-mix(in srgb, var(--turbid) 85%, white)">450 ppm TDS</p>
          </div>
          <div class="stage">
            <div class="stage-dot" style="background:color-mix(in srgb, var(--on-brand) 16%, #0b1f6e)">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="var(--on-brand)" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="var(--on-brand)" stroke-width="1.6" stroke-linecap="round"/></svg>
            </div>
            <p class="stage-name">Sediment&nbsp;filter</p>
            <p class="stage-tds">Silt and rust out</p>
          </div>
          <div class="stage">
            <div class="stage-dot" style="background:color-mix(in srgb, var(--brand) 45%, #0b1f6e)">
              <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="12" height="14" rx="2" stroke="var(--fresh-glow)" stroke-width="1.6"/><path d="M9 9h6M9 13h6" stroke="var(--fresh-glow)" stroke-width="1.6" stroke-linecap="round"/></svg>
            </div>
            <p class="stage-name">Activated&nbsp;carbon</p>
            <p class="stage-tds">Chlorine and odour out</p>
          </div>
          <div class="stage">
            <div class="stage-dot" style="background:color-mix(in srgb, var(--fresh) 45%, #0b1f6e)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 16 0" stroke="var(--fresh-glow)" stroke-width="1.6"/><path d="M4 12a8 8 0 0 0 16 0" stroke="var(--fresh-glow)" stroke-width="1.6" stroke-dasharray="1.5 3"/></svg>
            </div>
            <p class="stage-name">RO&nbsp;membrane</p>
            <p class="stage-tds" style="color:var(--fresh-glow)">Dissolved solids out</p>
          </div>
          <div class="stage">
            <div class="stage-dot" style="background:color-mix(in srgb, var(--fresh-glow) 55%, #0b1f6e)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" stroke="var(--fresh-glow)" stroke-width="1.6"/></svg>
            </div>
            <p class="stage-name">UV + minerals</p>
            <p class="stage-tds" style="color:var(--fresh-glow)">90 ppm, ready to drink</p>
          </div>
        </div>
        <p class="journey-caption">What your water passes through on the way to your glass. Figures are typical for Kumbakonam borewell supply — your own water is measured on-site, free, before we recommend anything.</p>
      </div>
    </div>
  </div>
  <div class="wave-divider" aria-hidden="true">
    <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,80 L0,80 Z" fill="var(--surface)"/></svg>
  </div>
</section>

<div class="trust">
  <div class="wrap">
    <div class="trust-head">
      <h2>A trusted name in water purification</h2>
      <a class="rating-badge" href="https://www.justdial.com/Kumbakonam/H2o-Water-Care-Near-Arignar-Anna-School-Kambatta-Viswanathar-Street/9999PX435-X435-221231205219-C6R7_BZDET" target="_blank" rel="noopener noreferrer">
        <span class="rating-stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7L12 2.5Z"/></svg>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7L12 2.5Z"/></svg>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7L12 2.5Z"/></svg>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7L12 2.5Z"/></svg>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2.1 9.6l7-.7L12 2.5Z"/></svg>
        </span>
        <strong>5.0</strong> · 100+ ratings on JustDial
      </a>
    </div>
    <div class="trust-grid">
      <div class="trust-item">
        <div class="icon-circle icon-circle--sm"><svg viewBox="0 0 24 24" fill="none"><path d="m4 12 6 6L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        Doorstep installation
      </div>
      <div class="trust-item">
        <div class="icon-circle icon-circle--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21a8 8 0 0 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
        AMC plans available
      </div>
      <div class="trust-item">
        <div class="icon-circle icon-circle--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
        Genuine filters &amp; spares
      </div>
      <div class="trust-item">
        <div class="icon-circle icon-circle--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5C19 5.9 15.9 3 12 3S5 5.9 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
        Serving Kumbakonam &amp; nearby
      </div>
    </div>
  </div>
</div>

<section id="about">
  <div class="wrap about-grid">
    <div class="about-copy">
      <div class="photo-placeholder">
        <div class="photo-placeholder-slot" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <span>Photo placeholder — send a real photo of you, your technician or the shop and this gets replaced</span>
      </div>
      <h2 style="font-size:clamp(26px,3.6vw,36px); font-weight:700;">A local water filter supplier, built around one job.</h2>
      <p>H2O is a Kumbakonam-based water filter supplier, serving the city for 4+ years — sales and service for all types of water filters and purifiers. We install, service and maintain RO, UV, UF and softener systems, using genuine filters and cartridges, and we stay on call long after installation for annual maintenance, filter changes and repairs.</p>
      <p>Whether you're setting up a filter for the first time or your existing one needs a service, we test your water on-site, explain what it actually needs, and fit the right system for your household — not the most expensive one.</p>
      <a class="btn btn-primary" href="tel:+918754816289" style="margin-top:4px; width:fit-content;">Get a Free Water Test</a>
    </div>
    <div class="about-panel">
      <div class="about-photo">
        <img src="/images/WhatsApp%20Image%202026-09-19%20at%209.03.35%20AM.jpeg" alt="An H2O RO purifier installed in a customer's kitchen in Kumbakonam" />
      </div>
      <div class="row">
        <div class="icon-orb icon-orb--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5C19 5.9 15.9 3 12 3S5 5.9 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <div><strong>Based in Kumbakonam</strong><span>No. 38/1077, Bakkiyanathan Street, Thanjavur Main Road, Kumbakonam</span></div>
      </div>
      <div class="row">
        <div class="icon-orb icon-orb--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <div><strong>4+ years in business</strong><span>Rated 5.0 from 100+ ratings on JustDial</span></div>
      </div>
      <div class="row">
        <div class="icon-orb icon-orb--sm"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 2v4M16 2v4M4 10h16" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <div><strong>Free on-site water test</strong><span>We measure TDS and hardness before recommending a system</span></div>
      </div>
      <div class="row">
        <div class="icon-orb icon-orb--sm"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21a8 8 0 0 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
        <div><strong>AMC after installation</strong><span>Scheduled filter changes so you never have to remember</span></div>
      </div>
    </div>
  </div>
</section>

<section id="services" style="background:var(--bg-soft)">
  <div class="wrap">
    <div class="section-head">
      <h2>Everything for the water at your tap.</h2>
      <p>From first installation to years of upkeep — sales, service, spares and support, all in one call.</p>
    </div>
    <div class="service-grid">
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.7"/><path d="M4 12a8 8 0 0 0 16 0" stroke="currentColor" stroke-width="1.7" stroke-dasharray="1.5 3"/></svg></div>
        <h3>RO Purifiers</h3>
        <p>Reverse-osmosis systems sized for your household and source water hardness.</p>
      </div>
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.6"/></svg></div>
        <h3>UV &amp; UF Purifiers</h3>
        <p>Ultraviolet and ultrafiltration systems for municipal supply and low-TDS sources.</p>
      </div>
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M6 3h12l-2 9H8L6 3Z" stroke="currentColor" stroke-width="1.6"/><path d="M8 12v6a4 4 0 0 0 8 0v-6" stroke="currentColor" stroke-width="1.6"/></svg></div>
        <h3>Water Softeners</h3>
        <p>Softening units for hard-water areas, protecting pipes, geysers and appliances.</p>
      </div>
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21a8 8 0 0 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
        <h3>AMC &amp; Service Plans</h3>
        <p>Scheduled filter changes and check-ups so your purifier keeps performing.</p>
      </div>
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.4-1.5-2.6-2.3.8a7 7 0 0 0-2.8-1.6L14 3h-4l-.2 2.6a7 7 0 0 0-2.8 1.6l-2.3-.8-1.5 2.6 2 1.4A7 7 0 0 0 5 12c0 .5 0 1.1.2 1.6l-2 1.5 1.5 2.6 2.3-.8a7 7 0 0 0 2.8 1.6L10 21h4l.2-2.6a7 7 0 0 0 2.8-1.6l2.3.8 1.5-2.6-2-1.5c.1-.5.2-1 .2-1.6Z" stroke="currentColor" stroke-width="1.3"/></svg></div>
        <h3>Spare Parts &amp; Filters</h3>
        <p>Genuine sediment, carbon, RO membrane and mineral cartridges, always in stock.</p>
      </div>
      <div class="service-card">
        <div class="service-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M3 11 12 4l9 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
        <h3>Free Installation</h3>
        <p>Site survey and fitting included whenever you buy a new system from us.</p>
      </div>
    </div>
  </div>
</section>

<section id="pricing">
  <div class="wrap">
    <div class="section-head">
      <h2>Simple, transparent pricing.</h2>
      <p>Exact cost depends on your household and source water — here's the shape of it. Call for a firm quote after the free water test.</p>
    </div>
    <div class="pricing-grid">
      <div class="pricing-card">
        <span class="pricing-flag">Placeholder — real pricing pending</span>
        <h3>RO Installation</h3>
        <div class="price-placeholder">Starting from <strong>₹ —,———</strong></div>
        <p>New RO system, sized for your household, fitted and tested.</p>
        <a class="btn btn-outline" href="tel:+918754816289">Ask for a quote</a>
      </div>
      <div class="pricing-card">
        <span class="pricing-flag">Placeholder — real pricing pending</span>
        <h3>AMC Plan</h3>
        <div class="price-placeholder"><strong>₹ ———</strong> / year</div>
        <p>Scheduled filter changes and check-ups for one year.</p>
        <a class="btn btn-outline" href="tel:+918754816289">Ask for a quote</a>
      </div>
      <div class="pricing-card">
        <span class="pricing-flag">Placeholder — real pricing pending</span>
        <h3>UV / UF Installation</h3>
        <div class="price-placeholder">Starting from <strong>₹ —,———</strong></div>
        <p>New UV or UF system for municipal or low-TDS supply.</p>
        <a class="btn btn-outline" href="tel:+918754816289">Ask for a quote</a>
      </div>
    </div>
  </div>
</section>

<section id="showcase" class="media-block">
  <div class="media-block-bg" aria-hidden="true">
    <img src="/images/WhatsApp%20Image%202026-09-19%20at%209.04.17%20AM.jpeg" alt="A commercial RO plant installed by H2O Water Care" />
  </div>
  <div class="wrap media-block-inner">
    <h2>Every installation, done properly.</h2>
    <p class="media-caption">Site survey, fitting, and a full walkthrough of your new system at your home — nothing rushed, nothing left unexplained.</p>
    <a class="btn btn-primary" href="tel:+918754816289">Call +91 87548 16289</a>
  </div>
</section>

<section id="why" class="why">
  <div class="wrap">
    <div class="section-head">
      <h2>The parts of the job people usually skip.</h2>
    </div>
    <div class="why-grid">
      <div class="why-item">
        <div class="icon-orb" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5C19 5.9 15.9 3 12 3S5 5.9 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>A local Kumbakonam team</h3>
        <p>No waiting days for an outstation technician — we're based right here.</p>
      </div>
      <div class="why-item">
        <div class="icon-orb" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>Genuine parts, always</h3>
        <p>No duplicate or refurbished cartridges — every filter is sourced genuine.</p>
      </div>
      <div class="why-item">
        <div class="icon-orb" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16" stroke="currentColor" stroke-width="1.8"/></svg></div>
        <h3>Transparent AMC pricing</h3>
        <p>You'll know the full cost of upkeep before you agree to anything.</p>
      </div>
      <div class="why-item">
        <div class="icon-orb" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M3 11 12 4l9 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>
        <h3>Doorstep, start to finish</h3>
        <p>Site visit, installation, and every repair happen at your home.</p>
      </div>
    </div>
  </div>
</section>

<section id="process">
  <div class="wrap">
    <div class="section-head">
      <h2>From first call to years of clean water.</h2>
    </div>
    <div class="process-layout">
      <div class="process-photo">
        <img src="/images/WhatsApp%20Image%202026-09-19%20at%209.04.30%20AM%20(1).jpeg" alt="A water softener installed by H2O Water Care in a Kumbakonam home" />
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-num">01</div>
          <h3>Call or enquire</h3>
          <p>Tell us about your current setup, or that you don't have one yet.</p>
        </div>
        <div class="step">
          <div class="step-num">02</div>
          <h3>Free site visit</h3>
          <p>We test your water's TDS and hardness before recommending anything.</p>
        </div>
        <div class="step">
          <div class="step-num">03</div>
          <h3>Installation</h3>
          <p>Fitted and tested at your home, with the fittings explained to you.</p>
        </div>
        <div class="step">
          <div class="step-num">04</div>
          <h3>Ongoing AMC</h3>
          <p>Scheduled filter changes and check-ins so performance never quietly drops.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap">
    <div class="section-head">
      <h2>Questions people ask us in Kumbakonam.</h2>
      <p>If yours isn't here, call us on +91 87548 16289 and we'll answer it directly.</p>
    </div>
    <div class="faq-list">
      <details class="faq-item" open>
        <summary>Do you service every brand of water filter, or only what you sell?</summary>
        <p>Every brand. We install and sell RO, UV, UF and softener systems, but our service and AMC plans cover any water filter already in your home, whichever company fitted it.</p>
      </details>
      <details class="faq-item">
        <summary>Is the water test really free?</summary>
        <p>Yes. We test your tap or borewell water's TDS and hardness on-site at no cost, before recommending any system — so you know what your water actually needs first.</p>
      </details>
      <details class="faq-item">
        <summary>How often does an RO filter or membrane need changing?</summary>
        <p>Sediment and carbon filters typically need changing every 6–12 months, and the RO membrane less often, depending on your water quality and usage. An AMC plan schedules this automatically so you don't have to track it.</p>
      </details>
      <details class="faq-item">
        <summary>What's covered under your AMC (annual maintenance) plan?</summary>
        <p>Scheduled filter and cartridge changes, a performance check-up, and priority call-out if something needs attention in between visits. Ask us for a plan sized to your specific system when we visit.</p>
      </details>
      <details class="faq-item">
        <summary>Which areas do you cover besides Kumbakonam town?</summary>
        <p>We regularly serve Thanjavur, Papanasam, Thiruvidaimarudur, Swamimalai and Darasuram, alongside Kumbakonam itself. Call us to check your specific area.</p>
      </details>
      <details class="faq-item">
        <summary>How soon can you install a new water purifier?</summary>
        <p>Most installations in Kumbakonam are scheduled within a few days of your first call, after the free site visit and water test confirm the right system for your home.</p>
      </details>
    </div>
  </div>
</section>

<section id="contact-wrap" style="padding-top:0;">
  <div class="wrap">
    <div id="contact" class="contact">
      <div>
        <h2>Ready for water you don't have to think about?</h2>
        <p class="lede">Call for a free site visit and water test — most installations in Kumbakonam are scheduled within a few days.</p>
        <div class="hero-actions" style="margin-top:22px;">
          <a class="btn btn-primary" href="tel:+918754816289">Call +91 87548 16289</a>
          <a class="btn btn-outline" href="https://wa.me/918754816289?text=Hi%2C%20I%27d%20like%20to%20book%20a%20free%20water%20test" target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
        </div>
        <p style="margin-top:24px; font-size:13px; color:var(--ink-faint);">Also serving Thanjavur, Papanasam, Thiruvidaimarudur, Swamimalai and Darasuram.</p>
      </div>
      <div class="contact-card">
        <div class="contact-row">
          <div class="icon-orb icon-orb--sm" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.1 7-11.5C19 5.9 15.9 3 12 3S5 5.9 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.4" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><strong>Address</strong><span>No. 38/1077, Bakkiyanathan Street,<br>Thanjavur Main Road,<br>Kumbakonam, Tamil Nadu 612001</span></div>
        </div>
        <div class="contact-row">
          <div class="icon-orb icon-orb--sm" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><strong>Phone / WhatsApp</strong><a href="tel:+918754816289">+91 87548 16289</a></div>
        </div>
        <div class="contact-row">
          <div class="icon-orb icon-orb--sm" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 2v4M16 2v4M4 10h16" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><strong>Service hours</strong><span>Call anytime to schedule a visit that works for you</span></div>
        </div>
        <div class="contact-row">
          <div class="icon-orb icon-orb--sm" style="--orb-a: var(--fresh-glow); --orb-b: var(--brand); --orb-shadow: var(--fresh-glow);"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 16h6M9 8h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 3h10a2 2 0 0 1 2 2v14a1 1 0 0 1-1.4.9L15 18l-2.6 1.9a1 1 0 0 1-1.2 0L8.6 18l-2.6 1.9A1 1 0 0 1 5 19V5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/></svg></div>
          <div><strong>GSTIN</strong><span>33GVQPS8564A1Z2</span></div>
        </div>
      </div>
    </div>
    <div class="map-embed">
      <iframe
        src="https://www.google.com/maps?q=No+38%2F1077+Bakkiyanathan+Street+Thanjavur+Main+Road+Kumbakonam+Tamil+Nadu+612001&output=embed"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="H2O Water Care location in Kumbakonam"
      ></iframe>
      <a class="btn btn-outline map-embed-cta" href="https://www.google.com/maps/search/?api=1&query=No+38%2F1077+Bakkiyanathan+Street+Thanjavur+Main+Road+Kumbakonam+Tamil+Nadu+612001" target="_blank" rel="noopener noreferrer">Get Directions</a>
    </div>
  </div>
</section>

<section class="callout">
  <div class="wrap callout-inner">
    <h2>Book your free water test today.</h2>
    <a class="btn btn-primary" href="tel:+918754816289">Call +91 87548 16289</a>
  </div>
</section>

<footer class="site">
  <div class="wrap footer-row">
    <div class="footer-brand">
      <span class="logo-word" style="font-family:'Sora',sans-serif; font-weight:800;">H2O Water Care</span>
      <span>&copy; 2026 H2O Water Care</span>
      <a href="https://billing.h2owaterpurifier.com/login" target="_blank" rel="noopener noreferrer" style="font-size:12px; text-decoration:none;">Staff Login</a>
    </div>
    <div class="footer-contact">
      <span>No. 38/1077, Bakkiyanathan Street, Thanjavur Main Road, Kumbakonam, Tamil Nadu 612001</span>
      <a href="tel:+918754816289">+91 87548 16289</a>
      <span style="font-size:12px;">GSTIN: 33GVQPS8564A1Z2</span>
    </div>
  </div>
</footer>

<div class="call-bar">
  <a href="tel:+918754816289">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" fill="#04212b"/></svg>
    Call H2O Now — +91 87548 16289
  </a>
</div>
`;
