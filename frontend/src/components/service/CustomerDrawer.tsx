'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, MessageCircle, Phone, Printer, ShieldCheck, ShoppingCart, Wallet, Wrench, X } from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';
import { frequencyLabel, SERVICE_TYPES } from '@/components/service/ServiceAdminModals';

interface Visit {
  id: string; status: string; dueDate: string; visitDate: string | null; closedAt: string | null;
  isExtra: boolean; serviceCategory: string | null; technician: string | null;
  feedback: string | null; requestNote: string | null; parts: string[];
  bill: { id: string; billNo: string | null; total: number } | null;
}

interface CustomerHistory {
  customer: {
    id: string; name: string; phone: string; address: string | null; city: string | null;
    landmark: string | null; gstin: string | null; cardNo: string | null; createdAt: string;
  };
  summary: { totalBusiness: number; paid: number; outstanding: number; salesCount: number; serviceCount: number; servicesDone: number };
  nextJob: { id: string; dueDate: string; status: string; product: string; technician: string | null } | null;
  warranties: Array<{
    id: string; product: string; status: string; startDate: string; warrantyPeriodMonths: number | null;
    serviceFrequency: string | null; frequencyMonths?: number | null; amcFrom: string | null; amcTo: string | null;
    visits: Visit[];
  }>;
  itemsSold: Array<{ invoiceId: string; billNo: string; date: string; name: string; qty: number; amount: number }>;
  dues: Array<{ invoiceId: string; billNo: string; billType: string; date: string; total: number; paid: number; due: number }>;
}

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const dateOf = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;
const endOfDay = (d: string) => new Date(d).getTime() + 24 * 60 * 60 * 1000 - 1;
export const serviceTypeLabel = (k: string | null) => SERVICE_TYPES.find(([key]) => key === k)?.[1] ?? null;

const OPEN = ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'];

// Colour + wording for a visit's state, overdue included.
export function VisitStatus({ status, dueDate }: { status: string; dueDate: string }) {
  const overdue = OPEN.includes(status) && endOfDay(dueDate) < Date.now();
  const [label, tone] = overdue
    ? ['Overdue', 'bg-red-100 text-red-700']
    : status === 'COMPLETED' ? ['Done', 'bg-green-100 text-green-700']
    : status === 'IN_PROGRESS' ? ['In progress', 'bg-amber-100 text-amber-700']
    : status === 'ASSIGNED' ? ['Assigned', 'bg-blue-100 text-blue-700']
    : status === 'SCHEDULED' ? ['Not assigned', 'bg-gray-100 text-gray-600']
    : status === 'REQUESTED' ? ['Awaiting approval', 'bg-purple-100 text-purple-700']
    : ['Cancelled', 'bg-gray-100 text-gray-400'];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

// Everything about one customer in a side panel: contact, money due, each AMC
// with all its visits (who, when, what was done) and what they bought.
export function CustomerDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api.get<CustomerHistory>(`/customers/${customerId}/history`)
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.message || 'Could not load this customer'); });
    return () => { cancelled = true; };
  }, [customerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reprint = async (invoiceId: string) => {
    setPrinting(invoiceId);
    try {
      const { data: inv } = await api.get(`/billing/invoices/${invoiceId}`);
      printReceipt(inv);
    } finally {
      setPrinting(null);
    }
  };

  const c = data?.customer;
  const address = c ? [c.address, c.city].filter(Boolean).join(', ') : '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-gray-50 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b bg-white px-4 py-3">
          {c ? (
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
                {c.name}
                {c.cardNo && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">#{c.cardNo}</span>}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-600"><Phone className="h-3.5 w-3.5" /> {c.phone}</a>
                <a href={waHref(c.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
              {address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 flex items-center gap-1 text-xs text-gray-600"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {address}{c.landmark ? ` · ${c.landmark}` : ''}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{error ?? 'Loading…'}</p>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {data && c && (
          <div className="flex-1 space-y-4 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Total business" value={money(data.summary.totalBusiness)} />
              <Tile label="Due" value={money(data.summary.outstanding)} tone={data.summary.outstanding > 0 ? 'text-red-600' : undefined} />
              <Tile label="Visits done" value={String(data.summary.servicesDone)} />
              <Tile
                label="Next visit"
                value={data.nextJob ? dateOf(data.nextJob.dueDate) : '—'}
                sub={data.nextJob ? data.nextJob.technician ?? 'Not assigned' : undefined}
                tone={data.nextJob && endOfDay(data.nextJob.dueDate) < Date.now() ? 'text-red-600' : undefined}
              />
            </div>

            {data.dues.length > 0 && (
              <Section icon={Wallet} title={`Money due · ${money(data.summary.outstanding)}`}>
                <div className="divide-y">
                  {data.dues.map((d) => (
                    <div key={d.invoiceId} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <p className="font-medium">
                          <span className="font-mono text-red-700">{d.billNo}</span>
                          <span className="ml-1.5 text-xs text-gray-400">{d.billType === 'SERVICE' ? 'Service bill' : 'Sales bill'} · {dateOf(d.date)}</span>
                        </p>
                        <p className="text-xs text-gray-500">Bill {money(d.total)} · paid {money(d.paid)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-600">{money(d.due)}</span>
                        <PrintButton busy={printing === d.invoiceId} onClick={() => reprint(d.invoiceId)} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section icon={ShieldCheck} title="AMC & service visits">
              {data.warranties.length === 0 ? (
                <p className="text-sm text-gray-400">No AMC / warranty registered</p>
              ) : (
                <div className="space-y-3">
                  {data.warranties.map((w) => (
                    <div key={w.id} className="rounded-lg border">
                      <div className="border-b bg-gray-50 px-3 py-2">
                        <p className="text-sm font-semibold">
                          {w.product} <span className="text-xs font-normal text-gray-500">{w.status.replace('_', ' ')}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Since {dateOf(w.startDate)}
                          {w.serviceFrequency && ` · service ${frequencyLabel(w.serviceFrequency, w.frequencyMonths).toLowerCase()}`}
                          {w.amcFrom && ` · AMC ${dateOf(w.amcFrom)}${w.amcTo ? ` → ${dateOf(w.amcTo)}` : ''}`}
                        </p>
                      </div>
                      {w.visits.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">No visits yet</p>
                      ) : (
                        <ol className="divide-y">
                          {w.visits.map((v) => <VisitRow key={v.id} v={v} onPrint={reprint} printing={printing} />)}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={ShoppingCart} title="Products bought">
              {data.itemsSold.length === 0 ? (
                <p className="text-sm text-gray-400">No sales bills</p>
              ) : (
                <div className="divide-y">
                  {data.itemsSold.map((it, i) => (
                    <div key={`${it.invoiceId}-${i}`} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{it.name} <span className="text-xs text-gray-500">× {it.qty}</span></p>
                        <p className="text-xs text-gray-400"><span className="font-mono">{it.billNo}</span> · {dateOf(it.date)}</p>
                      </div>
                      <span className="shrink-0">{money(it.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Link
              href={`/customers/${c.id}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Open full customer page (profit, quotations, new bill)
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function VisitRow({ v, onPrint, printing }: { v: Visit; onPrint: (id: string) => void; printing: string | null }) {
  const type = serviceTypeLabel(v.serviceCategory);
  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          <Wrench className="mr-1 inline h-3.5 w-3.5 text-gray-400" />
          Due {dateOf(v.dueDate)}
          {v.isExtra && <span className="ml-1.5 rounded bg-purple-50 px-1.5 text-[11px] text-purple-700">Extra visit</span>}
          {type && <span className="ml-1.5 rounded bg-gray-100 px-1.5 text-[11px] text-gray-600">{type}</span>}
        </p>
        <VisitStatus status={v.status} dueDate={v.dueDate} />
      </div>
      <p className="text-xs text-gray-600">
        {v.technician ? `Technician: ${v.technician}` : 'No technician yet'}
        {v.closedAt && ` · visited ${dateOf(v.visitDate ?? v.closedAt)}`}
      </p>
      {v.requestNote && <p className="text-xs text-gray-500">Request: {v.requestNote}</p>}
      {v.parts.length > 0 && <p className="text-xs text-gray-500">Parts: {v.parts.join(', ')}</p>}
      {v.feedback && <p className="text-xs italic text-gray-500">&ldquo;{v.feedback}&rdquo;</p>}
      {v.bill && (
        <p className="mt-0.5 flex items-center gap-2 text-xs">
          <span>Bill <span className="font-mono text-red-700">{v.bill.billNo}</span> · {money(v.bill.total)}</span>
          <PrintButton busy={printing === v.bill.id} onClick={() => onPrint(v.bill!.id)} />
        </p>
      )}
    </li>
  );
}

function PrintButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} className="rounded-md border p-1 text-gray-500 hover:bg-gray-50 disabled:opacity-50" title="View / print">
      <Printer className="h-3.5 w-3.5" />
    </button>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-bold ${tone || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <Icon className="h-4 w-4 text-red-700" /> {title}
      </h3>
      {children}
    </section>
  );
}
