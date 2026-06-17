'use client';

import React, { useState } from 'react';
import { useBillingStore } from '@/store/billing.store';
import { ChevronDown } from 'lucide-react';

const DISCOUNT_CAP = 15;

export function InvoiceSummary() {
  const store = useBillingStore();
  const [showDiscount, setShowDiscount] = useState(false);
  const discPct =
    store.discountType === 'PERCENT'
      ? store.discountValue
      : store.subtotal() > 0
        ? (store.discountAmount() / store.subtotal()) * 100
        : 0;
  const exceedsCap = discPct > DISCOUNT_CAP;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-gray-900">Order Summary</h2>

      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={`₹${store.subtotal().toFixed(2)}`} />
        <Row label="Tax (GST)" value={`₹${store.taxTotal().toFixed(2)}`} />
        {store.discountAmount() > 0 && (
          <Row
            label="Discount"
            value={`−₹${store.discountAmount().toFixed(2)}`}
            valueClass="text-green-600"
          />
        )}
        <div className="border-t pt-1.5">
          <Row
            label="Total"
            value={`₹${store.total().toFixed(2)}`}
            labelClass="font-bold text-base"
            valueClass="font-bold text-base text-red-700"
          />
        </div>
        {store.paidAmount() > 0 && (
          <>
            <Row label="Paid" value={`₹${store.paidAmount().toFixed(2)}`} valueClass="text-green-600" />
            <Row
              label={store.balance() >= 0 ? 'Balance Due' : 'Change'}
              value={`₹${Math.abs(store.balance()).toFixed(2)}`}
              valueClass={store.balance() > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}
            />
          </>
        )}
      </div>

      {/* Discount toggle */}
      <button
        onClick={() => setShowDiscount((v) => !v)}
        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
      >
        Apply Discount <ChevronDown className={`h-3 w-3 transition-transform ${showDiscount ? 'rotate-180' : ''}`} />
      </button>

      {showDiscount && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <select
              value={store.discountType || ''}
              onChange={(e) =>
                store.setDiscount(e.target.value as any, store.discountValue)
              }
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">No Discount</option>
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat Amount (₹)</option>
            </select>
            <input
              type="number"
              min={0}
              value={store.discountValue || ''}
              onChange={(e) =>
                store.setDiscount(store.discountType, parseFloat(e.target.value) || 0)
              }
              placeholder="0"
              className="w-24 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {exceedsCap && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Discount exceeds {DISCOUNT_CAP}%. Manager OTP override required at checkout.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  labelClass = 'text-gray-600',
  valueClass = 'text-gray-900',
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
