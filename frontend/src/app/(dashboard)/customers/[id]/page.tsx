'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, ClipboardList, MapPin, MessageCircle, Pencil, Phone, Printer,
  Receipt, ShieldCheck, ShoppingCart, Wrench,
} from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';
import { useBillingStore } from '@/store/billing.store';
import { WarrantyCardModal } from '@/components/service/WarrantyCardModal';

interface History {
  customer: {
    id: string; name: string; phone: string; email: string | null; address: string | null; city: string | null;
    landmark: string | null; gstin: string | null; cardNo: string | null; isActive: boolean; createdAt: string;
  };
  summary: {
    totalBusiness: number; paid: number; outstanding: number;
    salesCount: number; salesValue: number; serviceCount: number; serviceValue: number; servicesDone: number;
    revenueExGst: number; goodsCost: number; freePartsCost: number; staffExpenses: number; profit: number; costEstimated: boolean;
  };
  nextJob: { id: string; dueDate: string; status: string; product: string; technician: string | null } | null;
  warranties: Array<{
    id: string; product: string; status: string; startDate: string; warrantyPeriodMonths: number | null;
    serviceFrequency: string | null; amcFrom: string | null; amcTo: string | null; nextServiceDueAt: string | null;
  }>;
  timeline: Array<{
    kind: 'SALES_BILL' | 'SERVICE_BILL' | 'QUOTATION' | 'SERVICE_VISIT' | 'AMC';
    date: string; id: string; title: string; billNo?: string | null; amount?: number; due?: number; status?: string;
    technician?: string | null; feedback?: string | null; parts?: string[]; billed?: boolean; gstApplied?: boolean;
  }>;
}

type Filter = 'ALL' | 'BILLS' | 'SERVICE' | 'QUOTATION';

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateOf = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;

const KIND: Record<History['timeline'][number]['kind'], { label: string; icon: React.ElementType; tone: string }> = {
  SALES_BILL: { label: 'Sales bill', icon: ShoppingCart, tone: 'bg-red-50 text-red-700' },
  SERVICE_BILL: { label: 'Service bill', icon: Receipt, tone: 'bg-amber-50 text-amber-700' },
  QUOTATION: { label: 'Quotation', icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
  SERVICE_VISIT: { label: 'Service visit', icon: Wrench, tone: 'bg-green-50 text-green-700' },
  AMC: { label: 'AMC / warranty', icon: ShieldCheck, tone: 'bg-indigo-50 text-indigo-700' },
};

// One customer's whole relationship with the store: what we sold, services
// done, money in and out (profit/loss), and what's coming up next.
export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const setCartCustomer = useBillingStore((s) => s.setCustomer);
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<History>(`/customers/${id}/history`);
      setData(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not load this customer');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const timeline = useMemo(() => {
    const t = data?.timeline ?? [];
    if (filter === 'BILLS') return t.filter((e) => e.kind === 'SALES_BILL' || e.kind === 'SERVICE_BILL');
    if (filter === 'SERVICE') return t.filter((e) => e.kind === 'SERVICE_VISIT' || e.kind === 'SERVICE_BILL' || e.kind === 'AMC');
    if (filter === 'QUOTATION') return t.filter((e) => e.kind === 'QUOTATION');
    return t;
  }, [data, filter]);

  const reprint = async (invoiceId: string) => {
    setPrinting(invoiceId);
    try {
      const { data: inv } = await api.get(`/billing/invoices/${invoiceId}`);
      printReceipt(inv);
    } finally {
      setPrinting(null);
    }
  };

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const { customer: c, summary: s } = data;
  const profitPositive = s.profit >= 0;

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-4 py-4 sm:px-6">
        <button onClick={() => router.push('/customers')} className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Customers
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-gray-900">
              {c.name}
              {c.cardNo && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-sm text-blue-700">#{c.cardNo}</span>}
              {!c.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">Inactive</span>}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline"><Phone className="h-3.5 w-3.5" /> {c.phone}</a>
              <a href={waHref(c.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              {c.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([c.address, c.city].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-600 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> {[c.address, c.city].filter(Boolean).join(', ')}
                </a>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Customer since {dateOf(c.createdAt)}
              {c.landmark && ` · Landmark: ${c.landmark}`}
              {c.gstin && ` · GSTIN ${c.gstin}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCartCustomer(c.id); router.push('/billing/checkout'); }}
              className="flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              <ShoppingCart className="h-4 w-4" /> New sales bill
            </button>
            <button
              onClick={() => router.push(`/billing/service-bill?customerId=${c.id}`)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Receipt className="h-4 w-4" /> New service bill
            </button>
            <button
              onClick={() => router.push(`/customers?edit=${c.id}`)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Business summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total business" value={money(s.totalBusiness)} sub={`${s.salesCount + s.serviceCount} bills`} />
          <Stat label="Outstanding" value={money(s.outstanding)} sub={`Paid ${money(s.paid)}`} tone={s.outstanding > 0 ? 'text-red-600' : undefined} />
          <Stat label="Sales" value={money(s.salesValue)} sub={`${s.salesCount} bills`} />
          <Stat label="Service" value={money(s.serviceValue)} sub={`${s.serviceCount} bills · ${s.servicesDone} visits done`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Profit / loss */}
          <section className="rounded-xl border bg-white p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Profit / loss from this customer</h2>
            <div className="space-y-1.5 text-sm">
              <Row label="Bill value (before GST, after discount)" value={money(s.revenueExGst)} />
              <Row label="Cost of items sold" value={'− ' + money(s.goodsCost)} />
              <Row label="Spares used on free visits" value={'− ' + money(s.freePartsCost)} />
              <Row label="Technician expenses" value={'− ' + money(s.staffExpenses)} />
              <div className={`flex justify-between border-t pt-2 text-base font-bold ${profitPositive ? 'text-green-700' : 'text-red-700'}`}>
                <span>{profitPositive ? 'Profit' : 'Loss'}</span>
                <span>{money(Math.abs(s.profit))}</span>
              </div>
            </div>
            {s.costEstimated && (
              <p className="mt-2 text-xs text-gray-500">
                Some older bills didn&apos;t record the item cost at the time of sale — today&apos;s cost price is used for those.
              </p>
            )}
          </section>

          {/* Next service */}
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <CalendarClock className="h-4 w-4 text-red-700" /> Next service
            </h2>
            {data.nextJob ? (
              <div className="text-sm">
                <p className="font-semibold">{data.nextJob.product}</p>
                <p className={new Date(data.nextJob.dueDate) < new Date() ? 'font-semibold text-red-600' : 'text-gray-700'}>
                  Due {dateOf(data.nextJob.dueDate)}{new Date(data.nextJob.dueDate) < new Date() ? ' · Overdue' : ''}
                </p>
                <p className="text-gray-500">{data.nextJob.technician ? `Assigned to ${data.nextJob.technician}` : 'Not assigned yet'}</p>
                <Link href="/service/next-service" className="mt-2 inline-block text-xs text-red-700 underline">Open Next Service</Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No service visit scheduled</p>
            )}
          </section>
        </div>

        {/* AMCs */}
        {data.warranties.length > 0 && (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Warranty / AMC</h2>
            <div className="divide-y">
              {data.warranties.map((w) => {
                const until = w.warrantyPeriodMonths
                  ? new Date(new Date(w.startDate).setMonth(new Date(w.startDate).getMonth() + w.warrantyPeriodMonths))
                  : null;
                return (
                  <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium">{w.product} <span className="text-xs text-gray-400">{w.status.replace('_', ' ')}</span></p>
                      <p className="text-xs text-gray-500">
                        Warranty {dateOf(w.startDate)}{until ? ` → ${dateOf(until.toISOString())}` : ''}
                        {w.amcFrom && ` · AMC ${dateOf(w.amcFrom)}${w.amcTo ? ` → ${dateOf(w.amcTo)}` : ''}`}
                        {w.serviceFrequency && ` · ${w.serviceFrequency.replace('_', ' ').toLowerCase()} service`}
                      </p>
                    </div>
                    <button
                      onClick={() => setCardFor(w.id)}
                      className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Card
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Timeline */}
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">Activity</h2>
            <div className="flex gap-1">
              {([['ALL', 'All'], ['BILLS', 'Bills'], ['SERVICE', 'Service'], ['QUOTATION', 'Quotations']] as [Filter, string][]).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === k ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nothing here yet</p>
          ) : (
            <ol className="space-y-2">
              {timeline.map((e) => {
                const k = KIND[e.kind];
                const Icon = k.icon;
                const isBill = e.kind === 'SALES_BILL' || e.kind === 'SERVICE_BILL';
                return (
                  <li key={`${e.kind}-${e.id}`} className="flex gap-3 rounded-lg border p-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {k.label}
                          {e.billNo && <span className="ml-1.5 font-mono text-xs text-red-700">{e.billNo}</span>}
                          {e.status === 'CANCELLED' && <span className="ml-1.5 text-xs text-red-500">Cancelled</span>}
                        </p>
                        <span className="text-xs text-gray-400">{dateOf(e.date)}</span>
                      </div>
                      <p className="truncate text-gray-600">{e.title}</p>
                      {e.kind === 'SERVICE_VISIT' && (
                        <p className="text-xs text-gray-500">
                          {e.technician && `By ${e.technician}`}
                          {e.parts && e.parts.length > 0 && ` · Parts: ${e.parts.join(', ')}`}
                          {e.feedback && ` · "${e.feedback}"`}
                          {!e.billed && ' · Not billed'}
                        </p>
                      )}
                      {e.technician && e.kind === 'SERVICE_BILL' && <p className="text-xs text-gray-500">Technician {e.technician}</p>}
                    </div>
                    {e.amount !== undefined && (
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-semibold">{money(e.amount)}</p>
                        {!!e.due && e.due > 0 && e.status !== 'CANCELLED' && <p className="text-xs text-red-600">Due {money(e.due)}</p>}
                      </div>
                    )}
                    {isBill && (
                      <button
                        onClick={() => reprint(e.id)}
                        disabled={printing === e.id}
                        className="self-center rounded-lg border p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        title="View / print"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {cardFor && <WarrantyCardModal warrantyId={cardFor} onClose={() => setCardFor(null)} onSaved={load} />}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-700">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
