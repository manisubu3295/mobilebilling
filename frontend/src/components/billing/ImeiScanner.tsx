'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Search, ScanLine, X } from 'lucide-react';
import { useBillingStore } from '@/store/billing.store';
import api from '@/lib/api';

export function ImeiScanner() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useBillingStore();

  const handleSearch = useCallback(async (value: string) => {
    const query = value.trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setFound(null);

    try {
      let result: any = null;

      if (/^\d{15}$/.test(query)) {
        // 15-digit IMEI lookup
        const { data } = await api.get(`/billing/lookup/imei/${query}`);
        result = data;
      } else {
        // Barcode lookup
        const { data } = await api.get(`/billing/lookup/barcode/${encodeURIComponent(query)}`);
        result = data;
      }

      if (!result) {
        setError('No available item found for this IMEI / barcode.');
        return;
      }

      if (result.status !== 'IN_STOCK') {
        setError(`Item is ${result.status} — cannot add to invoice.`);
        return;
      }

      setFound(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Search failed. Check connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(input);
  };

  const handleAddToCart = () => {
    if (!found) return;
    const sku = found.sku;
    addItem({
      skuId: sku.id,
      productName: sku.product.name,
      variantName: sku.variantName,
      quantity: 1,
      unitPrice: parseFloat(sku.sellingPrice),
      taxRate: parseFloat(sku.taxRate),
      unit: sku.unit ?? 'pcs',
      isSerialized: true,
      serialIds: [found.id],
      hsnCode: sku.product.hsnCode ?? undefined,
    });
    setInput('');
    setFound(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan IMEI (15 digits) or barcode, then press Enter..."
            className="w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-500 font-mono"
            autoFocus
          />
          {input && (
            <button
              onClick={() => { setInput(''); setFound(null); setError(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => handleSearch(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
        >
          <Search className="h-4 w-4" />
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {found && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {found.sku.product.name} — {found.sku.variantName}
            </p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              {found.imei1 && `IMEI1: ${found.imei1}`}
              {found.imei2 && ` | IMEI2: ${found.imei2}`}
              {found.serialNumber && `S/N: ${found.serialNumber}`}
            </p>
            <p className="text-sm font-bold text-blue-600 mt-1">
              ₹{parseFloat(found.sku.sellingPrice).toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
          >
            Add to Cart
          </button>
        </div>
      )}
    </div>
  );
}
