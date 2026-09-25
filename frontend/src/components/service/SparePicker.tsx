'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import api from '@/lib/api';

export interface SpareResult {
  type: 'bulk' | 'serial' | 'service';
  found: boolean;
  skuId: string;
  productName: string;
  variantName: string;
  partNumber?: string;
  sellingPrice: any;
  taxRate: any;
  stockQty: number;
  unit?: string;
}

// Spare-part picker for technicians and service bills. The list opens right
// under the field (inline, so it can't be clipped inside a scrolling sheet on
// a phone) and shows the stocked spares as soon as it's tapped — typing just
// narrows it down.
export function SparePicker({ onPick, disabled, placeholder = 'Tap to pick a spare, or type to search…' }: {
  onPick: (r: SpareResult) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SpareResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const term = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<SpareResult[]>('/billing/lookup/search', {
          params: term ? { q: term } : { q: '', browse: 1 },
        });
        if (id === reqId.current) setResults(data.filter((r) => r.type !== 'service'));
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, q]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder={placeholder}
          className="w-full rounded-lg border py-2 pl-8 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          aria-label={open ? 'Hide spares' : 'Show spares'}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-1 max-h-56 overflow-auto rounded-lg border bg-white">
          {loading && results.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Loading…</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">{q.trim() ? 'No matching spares' : 'No spares in stock'}</p>
          )}
          {results.map((r) => {
            const unusable = !r.found || r.type === 'serial';
            return (
              <button
                key={r.skuId + (r.type === 'serial' ? '-s' : '')}
                type="button"
                disabled={unusable}
                onClick={() => { onPick(r); setQ(''); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-gray-50 ${unusable ? 'opacity-50' : ''}`}
              >
                <span className="min-w-0">
                  <span className="font-medium">{r.productName}</span>
                  {r.variantName && r.variantName !== 'Standard' && <span className="text-gray-500"> · {r.variantName}</span>}
                  {r.partNumber && <span className="ml-1 font-mono text-xs text-red-700">{r.partNumber}</span>}
                  {r.type === 'serial' && <span className="block text-xs text-gray-400">Serial-tracked — sell from Sales Bill</span>}
                  {!r.found && r.type !== 'serial' && <span className="block text-xs text-red-500">Out of stock</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-gray-500">
                  <span className="block text-sm font-semibold text-red-700">₹{parseFloat(r.sellingPrice).toLocaleString('en-IN')}</span>
                  {r.type === 'bulk' && `${r.stockQty} in stock`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
