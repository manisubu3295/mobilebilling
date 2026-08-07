'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useBillingStore } from '@/store/billing.store';
import { useAuthStore } from '@/store/auth.store';
import { PartScanner } from '@/components/billing/PartScanner';
import { CartTable } from '@/components/billing/CartTable';
import { PaymentPanel } from '@/components/billing/PaymentPanel';
import { InvoiceSummary } from '@/components/billing/InvoiceSummary';
import { PaymentQr } from '@/components/billing/PaymentQr';
import { ThermalReceipt } from '@/components/billing/ThermalReceipt';
import { CustomerSearch } from '@/components/billing/CustomerSearch';
import { saveDraftInvoice } from '@/lib/offline-db';
import { printReceipt } from '@/lib/print-receipt';
import api from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

export default function CheckoutPage() {
  const store = useBillingStore();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  const handleCheckout = useCallback(async () => {
    if (store.items.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    const payload = {
      customerId: store.customerId || undefined,
      items: store.items.map((item) => ({
        skuId: item.skuId,
        quantity: item.quantity,
        serialIds: item.serialIds.length > 0 ? item.serialIds : undefined,
      })),
      payments: store.payments,
      discountType: store.discountType || undefined,
      discountValue: store.discountValue || undefined,
      notes: store.notes || undefined,
    };

    if (!isOnline) {
      if (!user?.store?.id) {
        setError('Offline: cannot save draft — no active session.');
        setIsSubmitting(false);
        return;
      }
      await saveDraftInvoice(uuidv4(), payload, user.store.id);
      setError('Offline: Invoice saved as draft. Will sync when connected.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data } = await api.post('/billing/invoices', payload);
      setCreatedInvoice(data);
      store.clearCart();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  }, [store, isOnline, user]);

  /* ── Receipt view ───────────────────────────────────────────────── */
  if (createdInvoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto">
          <div className="no-print flex gap-3 mb-4">
            <button
              onClick={() => printReceipt(createdInvoice)}
              className="flex-1 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 font-medium text-sm"
            >
              Print Receipt
            </button>
            <button
              onClick={() => setCreatedInvoice(null)}
              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm"
            >
              New Invoice
            </button>
          </div>
          <div id="print-root" ref={printRef}>
            <ThermalReceipt invoice={createdInvoice} />
          </div>
          <div className="no-print mt-6">
            <PaymentQr invoiceId={createdInvoice.id} totalAmount={createdInvoice.totalAmount} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Checkout view ──────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between no-print shrink-0">
        <h1 className="font-bold text-gray-900">Checkout</h1>
        {!isOnline && (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            Offline
          </span>
        )}
      </div>

      {/* Desktop: side-by-side | Mobile: stacked + sticky checkout */}
      <div className="flex-1 overflow-auto lg:overflow-hidden flex flex-col lg:flex-row">

        {/* ── Left panel: customer + scanner + cart ───────────────── */}
        <div className="flex flex-col lg:flex-[2] lg:min-h-0 border-b lg:border-b-0 lg:border-r bg-white">
          {/* Customer */}
          <div className="p-3 border-b shrink-0">
            <CustomerSearch
              selectedId={store.customerId}
              onSelect={(id) => store.setCustomer(id)}
            />
          </div>
          {/* Scanner */}
          <div className="p-3 border-b shrink-0">
            <PartScanner />
          </div>
          {/* Cart */}
          <div className="overflow-auto min-h-[160px] lg:flex-1">
            <CartTable />
          </div>
        </div>

        {/* ── Right panel: summary + payment + checkout ────────────── */}
        <div className="flex flex-col lg:flex-[1] lg:min-h-0 bg-gray-50">
          <div className="p-3 space-y-3 lg:flex-1 lg:overflow-auto">
            <InvoiceSummary />
            <PaymentPanel />
          </div>

          {error && (
            <div className="mx-3 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm shrink-0">
              {error}
            </div>
          )}

          {/* Sticky checkout button — sticks to bottom on mobile */}
          <div className="p-3 border-t bg-white shrink-0 sticky bottom-0 lg:static z-10">
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || store.items.length === 0}
              className="w-full py-3 bg-red-700 text-white rounded-xl font-bold text-base
                         hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? 'Processing…'
                : store.items.length === 0
                  ? 'Add items to cart'
                  : `Complete Sale — ₹${store.total().toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
