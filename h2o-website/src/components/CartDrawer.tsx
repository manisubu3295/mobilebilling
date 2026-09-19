'use client';

import { useRef, useState } from 'react';
import { useCartStore } from '@/store/cart.store';
import { submitLead } from '@/lib/site-api';

const WHATSAPP_NUMBER = '918754816289';

function fmt(v: number) {
  return '₹' + v.toLocaleString('en-IN');
}

export function CartDrawer() {
  const { items, isOpen, close, remove, setQty, clear } = useCartStore();
  const [showEnquiry, setShowEnquiry] = useState(false);

  if (!isOpen) return null;

  const total = items.reduce((s, i) => s + (i.sellingPrice || 0) * i.qty, 0);
  const hasUnpriced = items.some((i) => i.sellingPrice == null);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>Your Cart</h2>
          <button onClick={close} className="text-2xl leading-none text-gray-400 hover:text-gray-700">&times;</button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 px-6 text-center">
            <p>Your cart is empty.</p>
            <p className="text-sm">Add a product to send us an enquiry.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto divide-y">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3 px-5 py-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--ink)' }}>{item.name}</p>
                    <p className="text-xs text-gray-400">{item.category}</p>
                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--brand)' }}>
                      {item.sellingPrice != null ? fmt(item.sellingPrice) : 'Price on enquiry'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => setQty(item.productId, item.qty - 1)}
                        className="w-6 h-6 rounded-full border text-sm flex items-center justify-center hover:bg-gray-50"
                      >
                        −
                      </button>
                      <span className="text-sm w-5 text-center">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.productId, item.qty + 1)}
                        className="w-6 h-6 rounded-full border text-sm flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                      <button
                        onClick={() => remove(item.productId)}
                        className="ml-auto text-xs text-gray-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t px-5 py-4 space-y-3">
              <div className="flex items-center justify-between font-semibold" style={{ color: 'var(--ink)' }}>
                <span>Total</span>
                <span>{fmt(total)}{hasUnpriced && '+'}</span>
              </div>
              {hasUnpriced && <p className="text-xs text-gray-400">Some items need a quote — final price confirmed when we call you.</p>}
              <button
                onClick={() => setShowEnquiry(true)}
                className="btn btn-primary w-full justify-center"
              >
                Send Enquiry
              </button>
            </div>
          </>
        )}
      </div>

      {showEnquiry && (
        <EnquiryModal
          onClose={() => setShowEnquiry(false)}
          onDone={() => { clear(); setShowEnquiry(false); close(); }}
        />
      )}
    </div>
  );
}

function EnquiryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { items } = useCartStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // A `disabled` prop only takes effect after React re-renders, so a fast
  // double-click can fire the handler twice before that happens. This ref is
  // checked synchronously, so the second click is dropped immediately.
  const inFlight = useRef(false);

  const leadItems = items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty }));
  const valid = name.trim().length > 1 && phone.trim().length >= 8;

  const cartSummaryText = () =>
    items.map((i) => `• ${i.name} × ${i.qty}`).join('\n');

  const handleWhatsApp = async () => {
    if (inFlight.current) return;
    if (!valid) { setError('Enter your name and phone number first.'); return; }
    inFlight.current = true;
    setError('');
    setSubmitting(true);
    await submitLead({ customerName: name, phone, email: email || undefined, address: address || undefined, message: message || undefined, items: leadItems, source: 'WHATSAPP' });
    const text = `Hi, I'm ${name} (${phone}). I'd like a quote for:\n${cartSummaryText()}${message ? `\n\nNote: ${message}` : ''}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setSubmitting(false);
    onDone();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    if (!valid) { setError('Enter your name and phone number.'); return; }
    inFlight.current = true;
    setError('');
    setSubmitting(true);
    const ok = await submitLead({ customerName: name, phone, email: email || undefined, address: address || undefined, message: message || undefined, items: leadItems, source: 'FORM' });
    setSubmitting(false);
    if (!ok) { inFlight.current = false; setError('Could not submit right now — please try WhatsApp instead, or call us.'); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-lg" style={{ color: 'var(--ink)' }}>How should we reach you?</h3>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else we should know? (optional)" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />

          <button type="button" onClick={handleWhatsApp} disabled={submitting} className="btn btn-primary w-full justify-center disabled:opacity-50">
            WhatsApp Us
          </button>
          <button type="submit" disabled={submitting} className="btn btn-outline w-full justify-center disabled:opacity-50">
            {submitting ? 'Sending…' : 'Submit Enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}
