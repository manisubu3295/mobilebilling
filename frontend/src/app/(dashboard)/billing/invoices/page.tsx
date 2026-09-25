'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Eye, XCircle, RefreshCw, FileText, Printer,
  RotateCcw, ChevronLeft, ChevronRight, X, CalendarDays, Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';
import { useAuthStore } from '@/store/auth.store';

/* ── Types ───────────────────────────────────────────────────────────── */
type InvoiceStatus = 'DRAFT' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'RETURNED';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  billNo?: string | null;
  billType?: 'SALES' | 'SERVICE';
  gstApplied?: boolean;
  status: InvoiceStatus;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
  customer: { name: string; phone: string } | null;
  createdBy: { name: string };
}

interface InvoiceDetail extends InvoiceRow {
  store: any;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  qrPayload?: string;
  notes?: string;
  items: Array<{
    id: string;
    description?: string | null;
    quantity: number;
    returnedQty: number;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    lineTotal: string;
    hsnCode?: string;
    sku: { variantName: string; unit: string; product: { name: string; partNumber?: string; hsnCode?: string } };
    serialUnits: Array<{ id: string; serialNumber?: string; batchNumber?: string }>;
  }>;
  payments: Array<{ id: string; mode: string; amount: string; reference?: string }>;
}

/* ── Constants ───────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<InvoiceStatus, string> = {
  PAID:          'bg-green-100 text-green-700',
  PARTIALLY_PAID:'bg-amber-100 text-amber-700',
  DRAFT:         'bg-gray-100 text-gray-600',
  CANCELLED:     'bg-red-100 text-red-600',
  RETURNED:      'bg-purple-100 text-purple-700',
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  PAID: 'Paid', PARTIALLY_PAID: 'Partial', DRAFT: 'Draft',
  CANCELLED: 'Cancelled', RETURNED: 'Returned',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card', BANK_TRANSFER: 'Bank Transfer', EMI: 'EMI',
};

type TypeFilter = '' | 'SALES' | 'SERVICE' | 'GST';
const TYPE_TABS: Array<[TypeFilter, string]> = [['', 'All'], ['SALES', 'Sales'], ['SERVICE', 'Service'], ['GST', 'GST']];

// Printed bill number with its series, e.g. "GST 004", "SRV 1450"; invoices
// from before bill series existed fall back to the internal invoice number.
function billLabel(inv: Pick<InvoiceRow, 'billNo' | 'billType' | 'gstApplied' | 'invoiceNumber'>) {
  if (!inv.billNo) return inv.invoiceNumber;
  const prefix = inv.billType === 'SERVICE' ? 'SRV' : inv.gstApplied !== false ? 'GST' : 'BILL';
  return `${prefix} ${inv.billNo}`;
}

function fmt(v: string | number) {
  return '₹' + parseFloat(String(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function InvoicesPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'STORE_MANAGER';

  /* list state */
  const [invoices, setInvoices]   = useState<InvoiceRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);

  /* filters */
  const [search, setSearch]       = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom]   = useState(today);
  const [dateTo, setDateTo]       = useState(today);
  const [statusFilter, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [editBillNo, setEditBillNo] = useState<string | null>(null);
  const [savingBillNo, setSavingBillNo] = useState(false);
  const searchTimer               = useRef<ReturnType<typeof setTimeout>>();

  /* modal state */
  const [selected, setSelected]   = useState<InvoiceDetail | null>(null);
  const [modalLoading, setML]     = useState(false);

  /* action state */
  const [cancelling, setCancelling]     = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returnModal, setReturnModal]   = useState(false);
  const [returnQtys, setReturnQtys]     = useState<Record<string, number>>({});
  const [returning, setReturning]       = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [payModal, setPayModal]         = useState(false);
  const [payMode, setPayMode]           = useState('CASH');
  const [payAmount, setPayAmount]       = useState('');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying]             = useState(false);

  const [listError, setListError] = useState('');

  /* ── Load list ────────────────────────────────────────────────── */
  const load = useCallback(async (
    p = 1, sq = search, from = dateFrom, to = dateTo, st = statusFilter, ty = typeFilter,
  ) => {
    setLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (sq.trim()) params.set('search', sq.trim());
      if (from)      params.set('from', from);   // plain YYYY-MM-DD; backend adds IST offset
      if (to)        params.set('to',   to);
      if (st)        params.set('status', st);
      if (ty)        params.set('type', ty);
      const { data } = await api.get(`/billing/invoices?${params}`);
      setInvoices(data.data);
      setTotal(data.total);
      setPage(p);
    } catch (e: any) {
      setListError(e?.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, statusFilter, typeFilter]);

  /* debounce all filter changes; fires on mount too (initial load) */
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, search, dateFrom, dateTo, statusFilter, typeFilter), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search, dateFrom, dateTo, statusFilter, typeFilter]);

  /* ── View detail ──────────────────────────────────────────────── */
  const handleView = async (id: string) => {
    setML(true);
    setActionError(null);
    try {
      const { data } = await api.get(`/billing/invoices/${id}`);
      setSelected(data);
      setReturnQtys({});
      setReturnModal(false);
      setPayModal(false);
    } catch (e: any) {
      setActionError(e?.response?.data?.message || 'Could not load invoice');
    } finally { setML(false); }
  };

  /* ── Correct a service bill number ─────────────────────────────── */
  const saveBillNo = async () => {
    if (!selected || editBillNo === null || !editBillNo.trim()) return;
    setSavingBillNo(true);
    setActionError(null);
    try {
      const { data } = await api.patch(`/billing/invoices/${selected.id}/bill-no`, { billNo: editBillNo.trim() });
      setSelected(data);
      setEditBillNo(null);
      load(page);
    } catch (e: any) {
      setActionError(e?.response?.data?.message || 'Could not change the bill number');
    } finally {
      setSavingBillNo(false);
    }
  };

  /* ── Print receipt ────────────────────────────────────────────── */
  const handlePrint = () => {
    if (!selected) return;
    printReceipt(selected);
  };

  /* ── Full cancel ──────────────────────────────────────────────── */
  const handleCancel = async () => {
    if (!selected) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.patch(`/billing/invoices/${selected.id}/cancel`);
      setConfirmCancel(false);
      await handleView(selected.id);
      load(page);
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Cancel failed');
    } finally { setCancelling(false); }
  };

  /* ── Return items ─────────────────────────────────────────────── */
  const openReturnModal = () => {
    if (!selected) return;
    const init: Record<string, number> = {};
    selected.items.forEach((item) => { init[item.id] = 0; });
    setReturnQtys(init);
    setReturnModal(true);
    setActionError(null);
  };

  const handleReturn = async () => {
    if (!selected) return;
    const returns = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
    if (returns.length === 0) { setActionError('Select at least one item to return.'); return; }
    setReturning(true);
    setActionError(null);
    try {
      await api.patch(`/billing/invoices/${selected.id}/return-items`, { returns });
      setReturnModal(false);
      await handleView(selected.id);
      load(page);
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Return failed');
    } finally { setReturning(false); }
  };

  /* ── Record repayment ─────────────────────────────────────────── */
  const balanceDue = selected ? parseFloat(selected.totalAmount) - parseFloat(selected.paidAmount) : 0;

  const openPayModal = () => {
    setPayMode('CASH');
    setPayAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
    setPayReference('');
    setPayModal(true);
    setActionError(null);
  };

  const handleAddPayment = async () => {
    if (!selected) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setActionError('Enter a valid amount.'); return; }
    setPaying(true);
    setActionError(null);
    try {
      await api.post(`/billing/invoices/${selected.id}/payments`, {
        mode: payMode,
        amount,
        reference: payReference || undefined,
      });
      setPayModal(false);
      await handleView(selected.id);
      load(page);
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to record payment');
    } finally { setPaying(false); }
  };

  const totalPages = Math.ceil(total / 20);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-400">{total} record{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Bill type tabs */}
        <div className="flex gap-1 mb-2">
          {TYPE_TABS.map(([key, label]) => (
            <button
              key={key || 'all'}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                typeFilter === key ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bill no, customer name, mobile or card no…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-700"
            >
              <option value="">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partial</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
            {(search || statusFilter || dateFrom !== today || dateTo !== today) && (
              <button
                onClick={() => { setSearch(''); setStatus(''); setDateFrom(today); setDateTo(today); }}
                className="ml-2 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading…
          </div>
        ) : listError ? (
          <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
            <p>{listError}</p>
            <button onClick={() => load(1)} className="text-sm text-red-700 underline">Retry</button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <FileText className="h-10 w-10 opacity-40" />
            <p>{search || statusFilter ? 'No invoices match your filters' : 'No invoices for this date range'}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="bg-white rounded-xl border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-red-700 font-semibold text-sm">{billLabel(inv)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{inv.customer?.name || <span className="italic text-gray-400">Walk-in</span>}</span>
                    <span className="font-bold text-gray-900">{fmt(inv.totalAmount)}</span>
                  </div>
                  {inv.customer?.phone && <p className="text-xs text-gray-400">{inv.customer.phone}</p>}
                  <div className="flex gap-2 pt-1 border-t">
                    <button
                      onClick={() => handleView(inv.id)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border hover:bg-red-50 text-gray-600 hover:text-red-700 flex items-center justify-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase">Bill No</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase">Paid</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase">By</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleView(inv.id)}>
                      <td className="px-4 py-3 font-mono text-red-700 font-semibold text-xs">
                        {billLabel(inv)}
                        {inv.billNo && <div className="font-normal text-[10px] text-gray-400">{inv.invoiceNumber}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {inv.customer ? (
                          <div>
                            <p className="font-medium text-gray-900">{inv.customer.name}</p>
                            <p className="text-xs text-gray-400">{inv.customer.phone}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(inv.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt(inv.paidAmount)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inv.createdBy?.name}</td>
                      <td className="px-4 py-3 text-center">
                        <Eye className="h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => load(page - 1)}
              disabled={page === 1}
              className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => load(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium min-w-[36px] ${
                    p === page ? 'bg-red-700 text-white' : 'border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => load(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 border rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-400 ml-1">{page}/{totalPages}</span>
          </div>
        )}
      </div>

      {/* ── Invoice Detail Modal ────────────────────────────────── */}
      {(selected || modalLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {modalLoading ? (
              <div className="flex justify-center items-center h-40">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : selected && (
              <>
                {/* Modal header */}
                <div className="flex items-start justify-between p-5 border-b">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {editBillNo !== null ? (
                        <span className="flex items-center gap-1">
                          <input
                            value={editBillNo}
                            onChange={(e) => setEditBillNo(e.target.value)}
                            className="w-24 border rounded px-2 py-1 text-sm font-mono"
                            autoFocus
                          />
                          <button onClick={saveBillNo} disabled={savingBillNo} className="text-xs font-semibold text-white bg-red-700 rounded px-2 py-1 disabled:opacity-50">
                            {savingBillNo ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditBillNo(null)} className="text-xs text-gray-500 px-1">Cancel</button>
                        </span>
                      ) : (
                        <>
                          <h2 className="text-base font-bold font-mono text-red-700">{billLabel(selected)}</h2>
                          {isManager && selected.billType === 'SERVICE' && (
                            <button onClick={() => setEditBillNo(selected.billNo || '')} className="text-xs text-red-700 underline">
                              Edit no.
                            </button>
                          )}
                        </>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[selected.status as InvoiceStatus]}`}>
                        {STATUS_LABEL[selected.status as InvoiceStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(selected.createdAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                      {selected.createdBy && ` · ${selected.createdBy.name}`}
                    </p>
                  </div>
                  <button onClick={() => { setSelected(null); setReturnModal(false); setConfirmCancel(false); setActionError(null); setEditBillNo(null); }} className="text-gray-400 hover:text-gray-700 ml-3">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-auto max-h-[70vh]">
                  {/* Customer */}
                  {selected.customer && (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <p className="font-semibold text-gray-800">{selected.customer.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {(selected.customer as any).phone}
                        {(selected.customer as any).customFields?.vehicle_no && ` · ${(selected.customer as any).customFields.vehicle_no}`}
                        {(selected.customer as any).customFields?.re_model   && ` · ${(selected.customer as any).customFields.re_model}`}
                      </p>
                    </div>
                  )}

                  {/* Items table */}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-center px-3 py-2">Qty</th>
                          <th className="text-center px-3 py-2">Ret.</th>
                          <th className="text-right px-3 py-2">Price</th>
                          <th className="text-right px-3 py-2">GST</th>
                          <th className="text-right px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selected.items?.map((item) => (
                          <tr key={item.id} className={item.returnedQty > 0 && item.returnedQty >= item.quantity ? 'opacity-50' : ''}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">{item.sku?.product?.name}</p>
                              <p className="text-xs text-gray-400">{item.sku?.variantName}</p>
                              {item.sku?.product?.partNumber && (
                                <p className="text-xs font-mono text-red-600">{item.sku.product.partNumber}</p>
                              )}
                              {item.serialUnits?.map((u) => (
                                <p key={u.id} className="text-xs font-mono text-gray-400">
                                  {u.serialNumber && `S/N: ${u.serialNumber}`}
                                  {u.batchNumber  && ` Batch: ${u.batchNumber}`}
                                </p>
                              ))}
                            </td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">
                              {item.returnedQty > 0 ? (
                                <span className="text-purple-600 font-semibold">{item.returnedQty}</span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right">{fmt(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-400">{item.taxRate}%</td>
                            <td className="px-3 py-2 text-right font-semibold">{fmt(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-56 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal</span><span>{fmt(selected.subtotal)}</span>
                      </div>
                      {parseFloat(selected.discountAmount) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Discount</span><span>−{fmt(selected.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-500">
                        <span>GST (incl.)</span><span>{fmt(selected.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1.5 text-base text-gray-900">
                        <span>Total</span><span>{fmt(selected.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Paid</span><span>{fmt(selected.paidAmount)}</span>
                      </div>
                      {parseFloat(selected.totalAmount) - parseFloat(selected.paidAmount) > 0.005 && (
                        <div className="flex justify-between text-amber-600 font-semibold">
                          <span>Balance Due</span>
                          <span>{fmt(parseFloat(selected.totalAmount) - parseFloat(selected.paidAmount))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payments */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Payments</p>
                    <div className="space-y-1">
                      {selected.payments?.map((p) => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {PAYMENT_LABELS[p.mode] || p.mode}
                            {p.reference && <span className="text-gray-400"> · {p.reference}</span>}
                          </span>
                          <span className="font-medium">{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Record Payment sub-panel */}
                  {payModal && selected.status !== 'CANCELLED' && selected.status !== 'RETURNED' && (
                    <div className="border border-green-200 rounded-xl p-4 bg-green-50">
                      <h3 className="font-semibold text-green-800 text-sm mb-3">Record Payment</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                          <select
                            value={payMode}
                            onChange={(e) => setPayMode(e.target.value)}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                          >
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="DEBIT_CARD">Debit Card</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="EMI">EMI</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            min={0.01}
                            max={balanceDue}
                            step="0.01"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reference (optional)</label>
                          <input
                            type="text"
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            placeholder="UTR / transaction ID…"
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Balance due: {fmt(balanceDue)}</p>
                      {actionError && <p className="text-red-600 text-xs mt-2">{actionError}</p>}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleAddPayment}
                          disabled={paying}
                          className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                        >
                          {paying ? 'Recording…' : 'Confirm Payment'}
                        </button>
                        <button
                          onClick={() => { setPayModal(false); setActionError(null); }}
                          className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Return Items sub-panel */}
                  {returnModal && selected.status !== 'CANCELLED' && selected.status !== 'RETURNED' && (
                    <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                      <h3 className="font-semibold text-purple-800 text-sm mb-3">Return Items</h3>
                      <div className="space-y-2">
                        {selected.items.map((item) => {
                          const max = item.quantity - item.returnedQty;
                          if (max <= 0) return null;
                          return (
                            <div key={item.id} className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{item.description || item.sku.product.name}</p>
                                <p className="text-xs text-gray-500">{item.sku.variantName} · Max returnable: {max}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))}
                                  className="w-7 h-7 rounded-lg border bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold"
                                >−</button>
                                <span className="w-8 text-center text-sm font-semibold">{returnQtys[item.id] || 0}</span>
                                <button
                                  onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.min(max, (q[item.id] || 0) + 1) }))}
                                  className="w-7 h-7 rounded-lg border bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center font-bold"
                                >+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {actionError && <p className="text-red-600 text-xs mt-2">{actionError}</p>}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleReturn}
                          disabled={returning}
                          className="flex-1 py-2 bg-purple-700 text-white rounded-lg text-sm font-semibold hover:bg-purple-800 disabled:opacity-50"
                        >
                          {returning ? 'Processing…' : 'Confirm Return'}
                        </button>
                        <button
                          onClick={() => { setReturnModal(false); setActionError(null); }}
                          className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {actionError && !returnModal && !payModal && (
                    <p className="text-red-600 text-sm bg-red-50 p-2.5 rounded-lg">{actionError}</p>
                  )}
                </div>

                {/* Modal footer actions */}
                <div className="flex flex-wrap gap-2 p-4 border-t bg-gray-50 rounded-b-2xl">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
                  >
                    <Printer className="h-4 w-4" /> Print Receipt
                  </button>

                  {balanceDue > 0.005 && selected.status !== 'CANCELLED' && selected.status !== 'RETURNED' &&
                    !payModal && !returnModal && !confirmCancel && (
                    <button
                      onClick={openPayModal}
                      className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50"
                    >
                      <Wallet className="h-4 w-4" /> Record Payment
                    </button>
                  )}

                  {isManager && selected.status !== 'CANCELLED' && selected.status !== 'RETURNED' && (
                    <>
                      {!returnModal && !confirmCancel && (
                        <button
                          onClick={openReturnModal}
                          className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50"
                        >
                          <RotateCcw className="h-4 w-4" /> Return Items
                        </button>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        {confirmCancel ? (
                          <>
                            <span className="text-xs text-red-600 font-medium">Restock all items and cancel?</span>
                            <button
                              onClick={handleCancel}
                              disabled={cancelling}
                              className="px-3 py-2 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
                            >
                              {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                            </button>
                            <button
                              onClick={() => setConfirmCancel(false)}
                              className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmCancel(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" /> Cancel Invoice
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
