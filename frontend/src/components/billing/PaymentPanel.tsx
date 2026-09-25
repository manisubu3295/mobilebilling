'use client';

import React, { useState } from 'react';
import { useBillingStore, PaymentEntry } from '@/store/billing.store';
import { Plus, Trash2 } from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'EMI', label: 'EMI' },
] as const;

export function PaymentPanel() {
  const { payments, addPayment, removePayment, total, balance } = useBillingStore();
  const [mode, setMode] = useState<PaymentEntry['mode']>('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    addPayment({ mode, amount: amt, reference: reference || undefined });
    setAmount('');
    setReference('');
  };

  // Records the full remaining balance as a payment in one tap. It used to
  // only fill the amount box, so a sale could be completed with nothing
  // actually recorded as paid if "Add Payment" wasn't pressed afterwards.
  const handleExact = () => {
    const bal = Math.round(balance() * 100) / 100;
    if (bal <= 0) return;
    addPayment({ mode, amount: bal, reference: reference || undefined });
    setAmount('');
    setReference('');
  };

  const pendingAmount = parseFloat(amount) > 0;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-gray-900">Payment</h2>

      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium">{p.mode}</span>
              {p.reference && <span className="text-xs text-gray-500">{p.reference}</span>}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-700">₹{p.amount.toFixed(2)}</span>
                <button onClick={() => removePayment(i)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentEntry['mode'])}
            className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="0.00"
              className="w-full pl-6 pr-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {(mode === 'CREDIT_CARD' || mode === 'UPI' || mode === 'BANK_TRANSFER' || mode === 'EMI') && (
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference / Transaction ID"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={handleExact}
            disabled={balance() <= 0}
            className="flex-1 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Paid in full: ₹{Math.max(0, balance()).toFixed(2)}
          </button>
          <button
            onClick={handleAdd}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium
                       hover:bg-red-800 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Payment
          </button>
        </div>
        {pendingAmount && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            ₹{parseFloat(amount).toFixed(2)} is not recorded yet — tap Add Payment.
          </p>
        )}
      </div>
    </div>
  );
}
