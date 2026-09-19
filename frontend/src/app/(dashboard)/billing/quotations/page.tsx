'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ClipboardList, Search, Trash2, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { CustomerSearch } from '@/components/billing/CustomerSearch';
import { printReceipt } from '@/lib/print-receipt';

interface Quotation {
  id: string;
  quotationNumber: string;
  status: 'OPEN' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  customer: { id: string; name: string; phone: string } | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  gstApplied: boolean;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string };
  convertedInvoiceId: string | null;
  items: Array<{
    id: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    lineTotal: string;
    sku: { variantName: string; unit: string; product: { name: string; partNumber?: string; hsnCode?: string } };
  }>;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Quotation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/quotations');
      setQuotations(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotations.length} records</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 shrink-0"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Quotation</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <ClipboardList className="h-10 w-10 opacity-40" />
            <p>No quotations yet</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {quotations.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelected(q)}
                  className="w-full bg-white rounded-xl border p-4 text-left hover:border-red-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-red-700">{q.quotationNumber}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{q.customer?.name || 'No customer'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{parseFloat(q.totalAmount).toLocaleString('en-IN')}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[q.status]}`}>{q.status}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(q)}>
                      <td className="px-4 py-3 font-mono text-red-700 font-medium">{q.quotationNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{q.customer?.name || '—'}</td>
                      <td className="px-4 py-3 font-semibold">₹{parseFloat(q.totalAmount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[q.status]}`}>{q.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(q.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                      <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-gray-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreate && <CreateQuotationModal onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); load(); }} />}
      {selected && (
        <QuotationDetailModal
          quotation={selected}
          onClose={() => setSelected(null)}
          onConverted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Create Quotation ────────────────────────────────────────────────── */

interface DraftItem {
  skuId: string;
  productName: string;
  variantName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  requiresService?: boolean;
}

function CreateQuotationModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { account } = useAuthStore();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [gstApplied, setGstApplied] = useState(true);
  const [discountType, setDiscountType] = useState<'' | 'PERCENT' | 'FLAT'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.get(`/billing/lookup/search?q=${encodeURIComponent(query)}`)
        .then(({ data }) => setResults(data))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addItem = (r: any) => {
    if (!r.found) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.skuId === r.skuId);
      if (existing) return prev.map((i) => (i.skuId === r.skuId ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, {
        skuId: r.skuId, productName: r.productName, variantName: r.variantName, unit: r.unit,
        quantity: 1, unitPrice: parseFloat(r.sellingPrice), taxRate: parseFloat(r.taxRate),
        requiresService: r.requiresService,
      }];
    });
    setQuery('');
    setResults([]);
  };

  const removeItem = (skuId: string) => setItems((prev) => prev.filter((i) => i.skuId !== skuId));
  const updateQty = (skuId: string, qty: number) =>
    setItems((prev) => prev.map((i) => (i.skuId === skuId ? { ...i, quantity: Math.max(0.01, qty) } : i)));

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxTotal = gstApplied ? items.reduce((s, i) => s + (i.unitPrice * i.quantity * i.taxRate) / 100, 0) : 0;
  const discountAmount = discountType === 'PERCENT' ? (subtotal * (parseFloat(discountValue) || 0)) / 100
    : discountType === 'FLAT' ? (parseFloat(discountValue) || 0) : 0;
  const total = subtotal + taxTotal - discountAmount;

  const needsCustomerForService = items.some((i) => i.requiresService) && !customerId;

  const handleSave = async () => {
    setError('');
    if (items.length === 0) { setError('Add at least one item.'); return; }
    if (needsCustomerForService) {
      setError('Please assign a customer before saving this quotation — it includes a service-eligible product requiring AMC registration upon conversion.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/quotations', {
        customerId: customerId || undefined,
        items: items.map((i) => ({ skuId: i.skuId, quantity: i.quantity })),
        discountType: discountType || undefined,
        discountValue: discountValue ? parseFloat(discountValue) : undefined,
        notes: notes || undefined,
        validUntil: validUntil || undefined,
        gstApplied,
      });
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">New Quotation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <CustomerSearch selectedId={customerId} onSelect={setCustomerId} />
          {needsCustomerForService && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              A customer is required to enable AMC registration for the service-eligible product in this quotation.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Add Item</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Product name, number, or barcode…"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {query.trim().length >= 2 && (
              <div className="border rounded-lg divide-y bg-white shadow-sm max-h-40 overflow-auto mt-1">
                {searching && <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>}
                {!searching && results.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => addItem(r)}
                    disabled={!r.found}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${!r.found ? 'opacity-50' : ''}`}
                  >
                    <span className="text-sm">{r.productName} <span className="text-gray-400">· {r.variantName}</span></span>
                    <span className="text-sm font-semibold text-red-700">₹{parseFloat(r.sellingPrice).toFixed(0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg divide-y">
              {items.map((i) => (
                <div key={i.skuId} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{i.productName}</p>
                    <p className="text-xs text-gray-500">{i.variantName} · ₹{i.unitPrice}/{i.unit}</p>
                  </div>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={i.quantity}
                    onChange={(e) => updateQty(i.skuId, parseFloat(e.target.value) || 0)}
                    className="w-16 border rounded px-1.5 py-1 text-center text-sm"
                  />
                  <span className="w-20 text-right font-semibold">₹{(i.unitPrice * i.quantity).toFixed(2)}</span>
                  <button onClick={() => removeItem(i.skuId)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount</label>
              <div className="flex gap-1">
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className="border rounded px-2 py-1.5 text-sm flex-1">
                  <option value="">None</option>
                  <option value="PERCENT">%</option>
                  <option value="FLAT">₹</option>
                </select>
                <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-20 border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>

          {account?.serviceModuleEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={gstApplied} onChange={(e) => setGstApplied(e.target.checked)} className="h-4 w-4 accent-red-700" />
              Include GST
            </label>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>GST</span><span>₹{taxTotal.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{discountAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-red-700">₹{total.toFixed(2)}</span></div>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Quotation Detail / Convert ──────────────────────────────────────── */

function QuotationDetailModal({ quotation, onClose, onConverted }: { quotation: Quotation; onClose: () => void; onConverted: () => void }) {
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'EMI'>('CASH');
  const [amount, setAmount] = useState(quotation.totalAmount);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleConvert = async () => {
    setError('');
    setConverting(true);
    try {
      const payAmount = parseFloat(amount) || 0;
      const { data } = await api.post(`/quotations/${quotation.id}/convert`, {
        payments: payAmount > 0 ? [{ mode, amount: payAmount }] : [],
      });
      printReceipt(data);
      onConverted();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to convert quotation');
    } finally {
      setConverting(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setCancelling(true);
    try {
      await api.patch(`/quotations/${quotation.id}/cancel`);
      onConverted();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to cancel quotation');
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold font-mono text-red-700">{quotation.quotationNumber}</h2>
            <p className="text-sm text-gray-500">{quotation.customer?.name || 'No customer'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="border rounded-lg divide-y">
            {quotation.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{i.sku.product.name}</p>
                  <p className="text-xs text-gray-500">{i.sku.variantName} · {i.quantity} {i.sku.unit} × ₹{i.unitPrice}</p>
                </div>
                <span className="font-semibold">₹{parseFloat(i.lineTotal).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{parseFloat(quotation.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>GST</span><span>{quotation.gstApplied ? `₹${parseFloat(quotation.taxAmount).toFixed(2)}` : 'Not applicable'}</span></div>
            {parseFloat(quotation.discountAmount) > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{parseFloat(quotation.discountAmount).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-red-700">₹{parseFloat(quotation.totalAmount).toFixed(2)}</span></div>
          </div>

          {quotation.status === 'OPEN' ? (
            <div className="border-t pt-4 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Convert to Invoice</p>
              <div className="flex gap-2">
                <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="border rounded-lg px-2 py-2 text-sm flex-1">
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="EMI">EMI</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-28 border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="w-full py-2.5 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:opacity-50"
              >
                {converting ? 'Converting…' : 'Convert to Invoice'}
              </button>

              {confirmingCancel ? (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-700">Cancel this quotation? This can&apos;t be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingCancel(false)}
                      className="flex-1 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-white"
                    >
                      Keep It
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingCancel(true)}
                  className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Cancel Quotation
                </button>
              )}
            </div>
          ) : (
            <div className="border-t pt-4">
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${STATUS_STYLE[quotation.status]}`}>
                {quotation.status === 'CONVERTED' ? 'Converted to invoice' : quotation.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
