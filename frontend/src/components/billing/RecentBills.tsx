'use client';

import React, { useEffect, useRef, useState } from 'react';
import { History, Printer, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';

interface Row {
  id: string;
  invoiceNumber: string;
  billNo?: string | null;
  billType?: 'SALES' | 'SERVICE';
  gstApplied?: boolean;
  status: string;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
  customer: { name: string; phone: string; cardNo?: string | null } | null;
}

const fmt = (v: string | number) => '₹' + parseFloat(String(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function label(r: Row) {
  if (!r.billNo) return r.invoiceNumber;
  return `${r.billType === 'SERVICE' ? 'SRV' : r.gstApplied !== false ? 'GST' : 'BILL'} ${r.billNo}`;
}

// "Recent bills" button + side panel on the Sales Bill / Service Bill pages:
// latest bills of that kind, searchable by bill no, name, phone or card no,
// each one viewable and reprintable in place.
export function RecentBills({ type }: { type: 'SALES' | 'SERVICE' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/billing/invoices', { params: { type, limit: 30, search: q.trim() || undefined } });
        if (id === reqId.current) setRows(data.data);
      } catch (e: any) {
        if (id === reqId.current) setError(e.response?.data?.message || 'Could not load bills');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, type]);

  const reprint = async (id: string) => {
    setPrinting(id);
    try {
      const { data } = await api.get(`/billing/invoices/${id}`);
      printReceipt(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not open this bill');
    } finally {
      setPrinting(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <History className="h-4 w-4" /> Recent bills
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Recent {type === 'SERVICE' ? 'service' : 'sales'} bills</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Bill no, name, mobile or card no…"
                  className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {error && <p className="m-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              {loading && rows.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-400">{q ? 'No bills match' : 'No bills yet'}</p>
              ) : (
                <div className="divide-y">
                  {rows.map((r) => {
                    const due = parseFloat(r.totalAmount) - parseFloat(r.paidAmount);
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-semibold text-red-700">{label(r)}</p>
                          <p className="truncate text-sm text-gray-800">
                            {r.customer?.name || 'Walk-in'}
                            {r.customer?.cardNo && <span className="ml-1 font-mono text-xs text-blue-700">#{r.customer.cardNo}</span>}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            {r.status === 'CANCELLED' && <span className="ml-1 text-red-500">· Cancelled</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{fmt(r.totalAmount)}</p>
                          {due > 0.005 && r.status !== 'CANCELLED' && <p className="text-xs text-red-600">Due {fmt(due)}</p>}
                        </div>
                        <button
                          onClick={() => reprint(r.id)}
                          disabled={printing === r.id}
                          className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Printer className="h-3.5 w-3.5" /> {printing === r.id ? '…' : 'View'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
