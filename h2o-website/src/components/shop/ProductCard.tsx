'use client';

import Link from 'next/link';
import type { WebsiteProduct } from '@/lib/site-api';
import { useCartStore } from '@/store/cart.store';
import { waLink } from '@/lib/site-contact';

export const rupees = (v: number) => '₹' + v.toLocaleString('en-IN');

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.2Z" />
    </svg>
  );
}

// A product tile: photo, name, capacity as the headline figure, price or
// "price on request", and the quote actions.
export function ProductCard({ product }: { product: WebsiteProduct }) {
  const add = useCartStore((s) => s.add);
  const image = product.images?.[0] || null;
  const mrp = product.mrpPrice ? parseFloat(product.mrpPrice) : null;
  const selling = product.sellingPrice ? parseFloat(product.sellingPrice) : null;
  const saving = mrp && selling && mrp > selling ? mrp - selling : null;
  const href = `/products/${product.id}`;

  return (
    <article className="p-card">
      <Link href={href} className="p-photo" tabIndex={-1} aria-hidden="true">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" />
        ) : (
          <span className="p-photo-empty">Photo on request</span>
        )}
      </Link>

      <div className="p-body">
        {product.brand && <p className="p-brand">{product.brand}</p>}
        <h3 className="p-name"><Link href={href}>{product.name}</Link></h3>

        {product.capacityLph != null && (
          <p className="p-cap">
            <span className="p-cap-num">{product.capacityLph}</span>
            <span className="p-cap-unit">litres per hour</span>
          </p>
        )}

        {product.shortDescription && <p className="p-desc">{product.shortDescription}</p>}

        <div className="p-foot">
          <div className="p-price">
            {selling != null ? (
              <>
                <span className="p-price-now">{rupees(selling)}</span>
                {saving ? (
                  <span className="p-price-was">
                    <s>{rupees(mrp!)}</s> <span className="p-save">Save {rupees(saving)}</span>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="p-price-ask">Price on request</span>
            )}
          </div>
          <div className="p-actions">
            <button
              type="button"
              className="btn-quote"
              onClick={() => add({ productId: product.id, name: product.name, category: product.category, sellingPrice: selling, image })}
            >
              Add to quote
            </button>
            {selling == null && (
              <a
                className="btn-wa"
                href={waLink(`Hi, please share the price of "${product.name}".`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ask the price of ${product.name} on WhatsApp`}
              >
                <WhatsAppIcon />
              </a>
            )}
          </div>
          {product.specSheetUrl && (
            <a className="p-spec" href={product.specSheetUrl} target="_blank" rel="noopener noreferrer">Spec sheet (PDF)</a>
          )}
        </div>
      </div>
    </article>
  );
}
