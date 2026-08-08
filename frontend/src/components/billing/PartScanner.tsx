'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Search, ScanLine, X, Plus, Minus, ChevronRight } from 'lucide-react';
import { useBillingStore } from '@/store/billing.store';
import { unitAllowsDecimal } from '@/lib/units';
import api from '@/lib/api';

interface PartResult {
  type: 'bulk' | 'serial';
  found: boolean;
  skuId: string;
  productName: string;
  partNumber?: string;
  variantName: string;
  unit: string;
  sellingPrice: any;
  taxRate: any;
  hsnCode?: string;
  stockQty: number;
  serialUnitId?: string;
  serialNumber?: string;
  batchNumber?: string;
  customFields?: Record<string, any>;
}

// KG/LITER/METER items need precise fractional entry (2.25, 0.5, …) — a plain
// controlled input bound straight to the numeric qty state would clobber a
// mid-typed "2." back to "2" on every render, so this keeps its own draft
// string and only commits a parsed value back out on blur.
function QtyDraftInput({
  value, onCommit, className,
}: { value: number; onCommit: (n: number) => void; className: string }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0.01"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n) && n > 0) onCommit(n);
        else setText(String(value)); // invalid entry — revert to last known-good value
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}

export function PartScanner() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PartResult[]>([]);
  const [selected, setSelected] = useState<PartResult | null>(null);
  const [qty, setQty] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem, items } = useBillingStore();
  const searchIdRef = useRef(0);

  // `auto` distinguishes a debounced live-typing search from an explicit one
  // (Enter / "Find" click): a live search always shows the picker list for
  // the user to choose from, even for a single match — jumping straight to
  // the add-to-cart panel on every keystroke that happens to narrow to one
  // result would be jarring. Enter/Find keep today's fast single-match path
  // (important for a barcode scanner's scan-then-Enter workflow).
  const handleSearch = useCallback(async (value: string, { auto }: { auto?: boolean } = {}) => {
    const query = value.trim();
    if (!query) return;
    const requestId = ++searchIdRef.current;
    setLoading(true);
    if (!auto) setError(null);
    setSelected(null);
    setQty(1);

    try {
      const { data } = await api.get<PartResult[]>(`/billing/lookup/search?q=${encodeURIComponent(query)}`);
      if (requestId !== searchIdRef.current) return; // superseded by a newer search

      if (!data || data.length === 0) {
        setResults([]);
        if (!auto) setError('Product not found. Try the product name, number, or barcode.');
        return;
      }

      if (!auto && data.length === 1) {
        const r = data[0];
        if (!r.found) {
          setError(`"${r.productName}" is out of stock.`);
          return;
        }
        setSelected(r);
      } else {
        setError(null);
        setResults(data);
      }
    } catch (err: any) {
      if (requestId !== searchIdRef.current) return;
      setResults([]);
      if (!auto) setError(err.response?.data?.message || 'Search failed. Check connection.');
    } finally {
      if (requestId === searchIdRef.current) setLoading(false);
    }
  }, []);

  // Live search-as-you-type — mirrors CustomerSearch.tsx's debounce so
  // suggestions show up without requiring an explicit "Find" click, without
  // firing a request per keystroke.
  useEffect(() => {
    if (input.trim().length < 2) {
      searchIdRef.current++; // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true); // instant "Searching…" feedback while the debounce timer runs
    const timer = setTimeout(() => handleSearch(input, { auto: true }), 300);
    return () => clearTimeout(timer);
  }, [input, handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(input);
  };

  // stockQty reflects total inventory, not what's left after this SKU's
  // existing cart quantity — account for that so the same units can't be
  // reserved twice by scanning the same part again.
  // Rounded to 3dp (matches the backend's Decimal(10,3) column) to avoid
  // floating-point noise like 1.2000000000000002 showing up in error text.
  const remainingStock = useCallback((part: PartResult) => {
    if (part.type !== 'bulk') return Infinity;
    const inCart = items
      .filter((i) => i.skuId === part.skuId && !i.isSerialized)
      .reduce((sum, i) => sum + i.quantity, 0);
    return Math.max(0, Math.round((part.stockQty - inCart) * 1000) / 1000);
  }, [items]);

  const handleAddToCart = (part: PartResult = selected!) => {
    if (!part) return;
    const addQty = part.type === 'serial' ? 1 : qty;
    if (part.type === 'bulk') {
      const remaining = remainingStock(part);
      if (addQty > remaining) {
        const inCart = part.stockQty - remaining;
        setError(
          remaining > 0
            ? `Only ${remaining} ${part.unit} left in stock (${inCart} already in cart).`
            : `All ${part.stockQty} ${part.unit} in stock are already in the cart.`,
        );
        return;
      }
    }

    addItem({
      skuId: part.skuId,
      productName: part.productName,
      variantName: part.variantName,
      partNumber: part.partNumber,
      unit: part.unit,
      quantity: addQty,
      unitPrice: parseFloat(part.sellingPrice),
      taxRate: parseFloat(part.taxRate),
      isSerialized: part.type === 'serial',
      serialIds: part.serialUnitId ? [part.serialUnitId] : [],
      serialNumber: part.serialNumber ?? undefined,
      hsnCode: part.hsnCode ?? undefined,
      stockQty: part.type === 'bulk' ? part.stockQty : undefined,
    });

    setInput('');
    setResults([]);
    setSelected(null);
    setError(null);
    setQty(1);
    inputRef.current?.focus();
  };

  const clear = () => {
    setInput('');
    setResults([]);
    setSelected(null);
    setError(null);
    setQty(1);
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Product name, number, or barcode…"
            className="w-full pl-10 pr-9 py-2.5 border rounded-lg text-sm focus:outline-none
                       focus:ring-2 focus:ring-red-500 font-mono"
            autoFocus
          />
          {input && (
            <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => handleSearch(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-red-700 text-white rounded-lg hover:bg-red-800
                     disabled:opacity-50 flex items-center gap-2 text-sm font-medium shrink-0"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{loading ? '…' : 'Find'}</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Live suggestions as you type, and the multi-match picker for an
          explicit search — tap one to select */}
      {!selected && input.trim().length >= 2 && (
        <div className="border rounded-lg divide-y bg-white shadow-sm max-h-56 overflow-auto">
          {loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No matches for &ldquo;{input.trim()}&rdquo;</p>
          )}
          {results.length > 0 && (
            <p className="px-3 py-2 text-xs text-gray-500 font-medium bg-gray-50">
              {results.length === 1 ? '1 match' : `${results.length} matches`} — tap to select
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                if (!r.found) { setError(`"${r.productName} — ${r.variantName}" is out of stock.`); return; }
                setSelected(r);
                setResults([]);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors
                          ${!r.found ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{r.productName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {r.variantName}
                  {r.partNumber && <span className="ml-1 font-mono text-gray-400">[{r.partNumber}]</span>}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-semibold text-red-700">₹{parseFloat(r.sellingPrice).toFixed(0)}</p>
                <p className={`text-xs ${r.found ? 'text-green-600' : 'text-red-500'}`}>
                  {r.type === 'bulk' ? `${r.stockQty} ${r.unit}` : r.found ? 'In stock' : 'Out of stock'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 ml-2 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Single result / selected part */}
      {selected && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">
                {selected.productName}
                {selected.partNumber && (
                  <span className="ml-1 text-xs text-gray-400 font-mono">[{selected.partNumber}]</span>
                )}
              </p>
              <p className="text-xs text-gray-500">{selected.variantName}</p>
              {selected.customFields?.notes && (
                <p className="text-xs text-gray-400">Note: {selected.customFields.notes}</p>
              )}
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {selected.type === 'serial'
                  ? `S/N: ${selected.serialNumber ?? 'auto-assigned'}`
                  : `Stock: ${selected.stockQty} ${selected.unit}`}
              </p>
              <p className="text-sm font-bold text-red-700 mt-0.5">
                ₹{parseFloat(selected.sellingPrice).toFixed(2)} / {selected.unit}
              </p>
            </div>
            <button onClick={clear} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selected.type === 'bulk' && (
              <div className="flex items-center gap-1 border rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setQty((q) => Math.max(unitAllowsDecimal(selected.unit) ? 0.01 : 1, q - 1))}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                {unitAllowsDecimal(selected.unit) ? (
                  <QtyDraftInput
                    value={qty}
                    onCommit={(n) => setQty(Math.min(remainingStock(selected), n))}
                    className="w-16 px-1 py-1 text-sm font-semibold text-center border-x"
                  />
                ) : (
                  <span className="px-3 text-sm font-semibold min-w-[2rem] text-center">{qty}</span>
                )}
                <button
                  onClick={() => setQty((q) => Math.min(remainingStock(selected), q + 1))}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => handleAddToCart(selected)}
              className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
            >
              Add {selected.type === 'bulk' ? `${qty} ${selected.unit}` : '1'} →
              ₹{(parseFloat(selected.sellingPrice) * (selected.type === 'bulk' ? qty : 1)).toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
