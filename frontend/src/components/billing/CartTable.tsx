'use client';

import React from 'react';
import { Trash2, Minus, Plus } from 'lucide-react';
import { useBillingStore } from '@/store/billing.store';

export function CartTable() {
  const { items, removeItem, updateQuantity } = useBillingStore();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-1">
        <p className="text-sm">Cart is empty</p>
        <p className="text-xs">Scan a barcode or enter an item code above</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: card list ─────────────────────────────────────── */}
      <div className="sm:hidden divide-y">
        {items.map((item) => {
          const lineBase = item.unitPrice * item.quantity;
          const lineTax = (lineBase * item.taxRate) / 100;
          const lineTotal = lineBase + lineTax;

          return (
            <div key={item.skuId} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 leading-tight">{item.productName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.variantName}
                  {item.partNumber && <span className="ml-1 font-mono text-gray-400">[{item.partNumber}]</span>}
                </p>
                {item.serialNumber && (
                  <p className="text-xs text-blue-500 font-mono">S/N: {item.serialNumber}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Qty control */}
                  <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.skuId, item.quantity - 1)}
                      disabled={item.isSerialized}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-sm font-semibold">{item.quantity} {item.unit}</span>
                    <button
                      onClick={() => updateQuantity(item.skuId, item.quantity + 1)}
                      disabled={item.isSerialized}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">× ₹{item.unitPrice.toFixed(0)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">₹{lineTotal.toFixed(2)}</p>
                <p className="text-xs text-gray-400">(+₹{lineTax.toFixed(0)} GST)</p>
                <button
                  onClick={() => removeItem(item.skuId)}
                  className="mt-1.5 p-3 rounded hover:bg-red-100 text-gray-300 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: table ────────────────────────────────────────── */}
      <table className="hidden sm:table w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Item</th>
            <th className="text-center px-2 py-2.5 font-medium text-gray-600 w-32">Qty</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600">Price</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600">GST</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
            <th className="px-2 py-2.5 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const lineBase = item.unitPrice * item.quantity;
            const lineTax = (lineBase * item.taxRate) / 100;
            const lineTotal = lineBase + lineTax;

            return (
              <tr key={item.skuId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-xs text-gray-500">
                    {item.variantName}
                    {item.partNumber && <span className="ml-1 font-mono text-gray-400">[{item.partNumber}]</span>}
                  </p>
                  {item.serialNumber && (
                    <p className="text-xs text-blue-500 font-mono mt-0.5">S/N: {item.serialNumber}</p>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.skuId, item.quantity - 1)}
                      disabled={item.isSerialized}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-12 text-center font-medium text-xs">{item.quantity} {item.unit}</span>
                    <button
                      onClick={() => updateQuantity(item.skuId, item.quantity + 1)}
                      disabled={item.isSerialized}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  ₹{item.unitPrice.toFixed(2)}<span className="text-xs text-gray-400">/{item.unit}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                  {item.taxRate}%<br />
                  <span className="font-medium text-gray-700">₹{lineTax.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  ₹{lineTotal.toFixed(2)}
                </td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => removeItem(item.skuId)}
                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
