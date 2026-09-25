'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wrench, UserPlus, Plus, Search, Phone, MessageCircle, MapPin, XCircle, Receipt, Pencil, RotateCcw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';
import { AmcOnboardModal } from '@/components/service/AmcOnboardModal';
import { WarrantyCardModal } from '@/components/service/WarrantyCardModal';
import {
  AddVisitModal, AmcEditModal, ApproveRequestModal, FrequencyPicker, VisitEditModal, frequencyLabel,
} from '@/components/service/ServiceAdminModals';

interface WarrantyCustomer { id: string; name: string; phone: string; address: string | null; cardNo?: string | null }
interface WarrantyProduct { id: string; name: string; brand?: string | null }
// Only present when this warranty came from an actual sale in this system —
// null for a standalone/imported AMC (no serial number to show either way).
interface WarrantyInvoiceItem {
  serialUnits?: { serialNumber: string | null }[];
}

interface Warranty {
  id: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'CANCELLED';
  warrantyPeriodMonths: number | null;
  serviceFrequency: string | null;
  frequencyMonths?: number | null;
  amcFrom?: string | null;
  amcTo?: string | null;
  notes?: string | null;
  startDate: string;
  nextServiceDueAt: string | null;
  customer: WarrantyCustomer;
  product: WarrantyProduct;
  invoiceItem: WarrantyInvoiceItem | null;
}

interface ServiceJobPart {
  id: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  sku: { variantName: string; unit: string; product: { name: string } };
}

interface ServiceJob {
  id: string;
  dueDate: string;
  visitDate: string | null;
  closedAt: string | null;
  status: 'REQUESTED' | 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isExtra?: boolean;
  serviceCategory?: string | null;
  assignedTo: { id: string; name: string } | null;
  customerFeedback: string | null;
  staffExpenseAmount: string | null;
  staffExpenseNotes: string | null;
  customerChargeAmount: string | null;
  customerChargeNotes: string | null;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; billNo?: string | null; totalAmount: string } | null;
  parts: ServiceJobPart[];
  warranty: {
    customer: WarrantyCustomer;
    product: WarrantyProduct;
    invoiceItem: WarrantyInvoiceItem | null;
  };
}

const JOB_STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700',
  SCHEDULED: 'bg-gray-100 text-gray-600',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const AMC_STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;

// Default visibility window for Service Jobs / All AMCs — 15 days back,
// 400 days ahead — so both screens open on "what's relevant right now"
// instead of every job/AMC ever created, while still covering a freshly
// approved/registered AMC's first due date, which can be up to a year out
// (YEARLY service frequency). Custom range overrides it.
const toDateInput = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
function defaultDateRange() {
  const from = new Date();
  from.setDate(from.getDate() - 15);
  const to = new Date();
  to.setDate(to.getDate() + 400);
  return { from: toDateInput(from), to: toDateInput(to) };
}

// Small shared contact strip — phone/WhatsApp are useful on both the
// pending-approval and job rows, so this isn't duplicated per tab.
function ContactLinks({ customer }: { customer: WarrantyCustomer }) {
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <Phone className="h-3 w-3" /> Call
      </a>
      <a href={waHref(customer.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-green-600 hover:underline">
        <MessageCircle className="h-3 w-3" /> WhatsApp
      </a>
      {customer.address && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(customer.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-gray-500 hover:underline max-w-[220px] truncate"
          title={customer.address}
        >
          <MapPin className="h-3 w-3 shrink-0" /> {customer.address}
        </a>
      )}
    </div>
  );
}

// Shared by the Service Jobs and All AMCs tabs — a compact from/to date pair
// with a reset link back to the -15d/+30d default window.
function DateRangeFilter({
  from, to, onChange, onReset,
}: { from: string; to: string; onChange: (from: string, to: string) => void; onReset: () => void }) {
  const isDefault = JSON.stringify({ from, to }) === JSON.stringify(defaultDateRange());
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="border rounded-lg px-2 py-2 text-sm bg-white"
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="border rounded-lg px-2 py-2 text-sm bg-white"
      />
      {!isDefault && (
        <button onClick={onReset} className="text-xs text-red-700 hover:underline font-medium">
          Reset
        </button>
      )}
    </div>
  );
}

type AmcWithJobs = Warranty & { serviceJobs: AmcJob[] };
type AmcJob = Omit<ServiceJob, 'warranty'>;
type ReviewRequest = ServiceJob & { requestNote: string | null; requestedBy: { id: string; name: string } | null };

const OPEN_STATUSES = ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'];
const dateText = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
const isOpenJob = (j: { status: string }) => OPEN_STATUSES.includes(j.status);
const jobOverdue = (j: { status: string; dueDate: string }) => isOpenJob(j) && new Date(j.dueDate) < new Date(new Date().toDateString());

// Next open regular visit of an AMC (falls back to any open visit).
function nextVisit(a: AmcWithJobs) {
  const open = a.serviceJobs.filter(isOpenJob).sort((x, y) => new Date(x.dueDate).getTime() - new Date(y.dueDate).getTime());
  return open.find((j) => !j.isExtra) ?? open[0] ?? null;
}

// Service screen: everything about AMCs and their visits in one list — each
// AMC row expands to its visits (done / upcoming / overdue) with actions —
// plus a "To review" tab for pending AMC claims and technicians' requests.
export default function ServiceAdminPage() {
  const [tab, setTab] = useState<'review' | 'service'>('service');
  const [pending, setPending] = useState<Warranty[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [amcs, setAmcs] = useState<AmcWithJobs[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // filters
  const [query, setQuery] = useState('');
  const [techFilter, setTechFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'OVERDUE' | 'UNASSIGNED' | 'ALL' | 'CANCELLED'>('OPEN');
  const [dates, setDates] = useState(defaultDateRange);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // modals
  const [approving, setApproving] = useState<Warranty | null>(null);
  const [rejecting, setRejecting] = useState<Warranty | null>(null);
  const [approvingReq, setApprovingReq] = useState<ReviewRequest | null>(null);
  const [rejectingReq, setRejectingReq] = useState<ReviewRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assigning, setAssigning] = useState<ServiceJob | null>(null);
  const [rescheduling, setRescheduling] = useState<ServiceJob | null>(null);
  const [cancellingJob, setCancellingJob] = useState<ServiceJob | null>(null);
  const [editingVisit, setEditingVisit] = useState<{ job: AmcJob; title: string } | null>(null);
  const [editingAmc, setEditingAmc] = useState<AmcWithJobs | null>(null);
  const [addingVisit, setAddingVisit] = useState<AmcWithJobs | null>(null);
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [reactivatingAmc, setReactivatingAmc] = useState<Warranty | null>(null);
  const [cancellingAmc, setCancellingAmc] = useState<Warranty | null>(null);
  const [showAmcOnboard, setShowAmcOnboard] = useState(false);
  const [error, setError] = useState('');
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, all, r, u] = await Promise.all([
        api.get('/warranty', { params: { status: 'PENDING_APPROVAL' } }),
        api.get('/warranty', { params: { withJobs: 1 } }),
        api.get('/warranty/service-jobs', { params: { status: 'REQUESTED' } }),
        api.get('/users/technicians'),
      ]);
      setPending(p.data);
      setAmcs(all.data.filter((w: Warranty) => w.status !== 'PENDING_APPROVAL'));
      setRequests(r.data);
      setStaff(u.data.filter((usr: any) => usr.role === 'SERVICE_STAFF'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withWarranty = (a: AmcWithJobs, j: AmcJob): ServiceJob =>
    ({ ...j, warranty: { customer: a.customer, product: a.product, invoiceItem: a.invoiceItem } }) as ServiceJob;

  const handleViewInvoice = async (invoiceId: string) => {
    setViewingInvoiceId(invoiceId);
    try {
      const { data } = await api.get(`/billing/invoices/${invoiceId}`);
      printReceipt(data);
    } finally {
      setViewingInvoiceId(null);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dates.from ? new Date(dates.from + 'T00:00:00') : null;
    const to = dates.to ? new Date(dates.to + 'T23:59:59') : null;
    return amcs
      .filter((a) => {
        if (statusFilter === 'CANCELLED') { if (a.status !== 'CANCELLED') return false; }
        else if (statusFilter !== 'ALL' && a.status !== 'ACTIVE') return false;
        const next = nextVisit(a);
        if (statusFilter === 'OPEN' && !next) return false;
        if (statusFilter === 'OVERDUE' && !a.serviceJobs.some(jobOverdue)) return false;
        if (statusFilter === 'UNASSIGNED' && !a.serviceJobs.some((j) => isOpenJob(j) && !j.assignedTo)) return false;
        if (techFilter !== 'ALL') {
          const open = a.serviceJobs.filter(isOpenJob);
          if (techFilter === 'NONE' ? !open.some((j) => !j.assignedTo) : !a.serviceJobs.some((j) => j.assignedTo?.id === techFilter)) return false;
        }
        if (next && statusFilter !== 'ALL' && statusFilter !== 'CANCELLED' && statusFilter !== 'OVERDUE') {
          const due = new Date(next.dueDate);
          if ((from && due < from && !jobOverdue(next)) || (to && due > to)) return false;
        }
        if (!q) return true;
        return (
          a.customer.name.toLowerCase().includes(q) ||
          a.customer.phone.includes(q) ||
          (a.customer.cardNo || '').toLowerCase() === q ||
          a.product.name.toLowerCase().includes(q) ||
          a.serviceJobs.some((j) => j.assignedTo?.name.toLowerCase().includes(q))
        );
      })
      .sort((x, y) => {
        const nx = nextVisit(x), ny = nextVisit(y);
        return (nx ? new Date(nx.dueDate).getTime() : Infinity) - (ny ? new Date(ny.dueDate).getTime() : Infinity);
      });
  }, [amcs, query, statusFilter, techFilter, dates]);

  const overdueCount = amcs.filter((a) => a.status === 'ACTIVE' && a.serviceJobs.some(jobOverdue)).length;
  const reviewCount = pending.length + requests.length;

  const rejectRequest = async () => {
    if (!rejectingReq || !rejectReason.trim()) return;
    setError('');
    try {
      await api.patch(`/warranty/service-requests/${rejectingReq.id}/reject`, { reason: rejectReason.trim() });
      setRejectingReq(null);
      setRejectReason('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not reject the request');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="h-5 w-5 text-red-700" /> Service</h1>
          <button
            onClick={() => setShowAmcOnboard(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
          >
            <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Register AMC</span>
          </button>
        </div>
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab('service')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'service' ? 'bg-red-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            AMCs &amp; visits
            {overdueCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === 'service' ? 'bg-white/20' : 'bg-red-100 text-red-600'}`}>{overdueCount} overdue</span>
            )}
          </button>
          <button
            onClick={() => setTab('review')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'review' ? 'bg-red-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            To review
            {reviewCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === 'review' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{reviewCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : tab === 'review' ? (
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Service requests from technicians ({requests.length})</h2>
              {requests.length === 0 ? (
                <p className="rounded-xl border bg-white p-4 text-sm text-gray-400">No requests waiting</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((r) => (
                    <div key={r.id} className="bg-white rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{r.warranty.product.name}</p>
                          <p className="text-sm text-gray-500">
                            {r.warranty.customer.cardNo && <span className="mr-1 font-mono text-xs font-semibold text-blue-700">#{r.warranty.customer.cardNo}</span>}
                            <Link href={`/customers/${r.warranty.customer.id}`} className="hover:underline">{r.warranty.customer.name}</Link> · {r.warranty.customer.phone}
                          </p>
                          <p className="mt-1 text-sm text-gray-700">
                            <span className="font-medium">{r.requestedBy?.name ?? 'Technician'}</span> asked for {dateText(r.dueDate)}
                            {r.requestNote && <span className="text-gray-500"> · &ldquo;{r.requestNote}&rdquo;</span>}
                          </p>
                        </div>
                        {rejectingReq?.id === r.id ? (
                          <div className="flex w-full gap-2 sm:w-auto">
                            <input autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason" className="flex-1 rounded-lg border px-3 py-1.5 text-sm" />
                            <button onClick={rejectRequest} disabled={!rejectReason.trim()} className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Reject</button>
                            <button onClick={() => setRejectingReq(null)} className="rounded-lg border px-3 py-1.5 text-sm text-gray-600">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => { setRejectingReq(r); setRejectReason(''); }} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
                              <XCircle className="h-4 w-4" /> Reject
                            </button>
                            <button onClick={() => setApprovingReq(r)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Approve</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">AMC claims from sales ({pending.length})</h2>
              {pending.length === 0 ? (
                <p className="rounded-xl border bg-white p-4 text-sm text-gray-400">No AMC claims waiting for approval</p>
              ) : (
                <div className="space-y-3">
                  {pending.map((w) => {
                    const serial = w.invoiceItem?.serialUnits?.[0]?.serialNumber;
                    return (
                      <div key={w.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {w.product.name}
                            {serial && <span className="ml-2 text-xs font-mono text-gray-400">S/N {serial}</span>}
                          </p>
                          <p className="text-sm text-gray-500">
                            {w.customer.cardNo && <span className="mr-1 font-mono text-xs font-semibold text-blue-700">#{w.customer.cardNo}</span>}
                            <Link href={`/customers/${w.customer.id}`} className="hover:underline">{w.customer.name}</Link> · {w.customer.phone}
                          </p>
                          <ContactLinks customer={w.customer} />
                          <p className="text-xs text-gray-400 mt-1">Sold {dateText(w.startDate)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setRejecting(w)} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50">
                            <XCircle className="h-4 w-4" /> <span className="hidden sm:inline">Reject</span>
                          </button>
                          <button onClick={() => setApproving(w)} className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800">Approve</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search customer, phone, card no, product or technician…"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="OPEN">Upcoming visits</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="UNASSIGNED">Needs a technician</option>
                  <option value="ALL">All AMCs</option>
                  <option value="CANCELLED">Cancelled AMCs</option>
                </select>
                <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="ALL">All technicians</option>
                  <option value="NONE">Not assigned</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {statusFilter === 'OPEN' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  Next visit between
                  <DateRangeFilter from={dates.from} to={dates.to} onChange={(from, to) => setDates({ from, to })} onReset={() => setDates(defaultDateRange())} />
                  <span>(overdue always shown)</span>
                </div>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Search className="h-10 w-10 opacity-40" />
                <p>{amcs.length === 0 ? 'No AMCs yet — use Register AMC' : 'Nothing matches these filters'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((a) => {
                  const next = nextVisit(a);
                  const open = !!expanded[a.id];
                  const warrantyEnd = a.warrantyPeriodMonths
                    ? new Date(new Date(a.startDate).setMonth(new Date(a.startDate).getMonth() + a.warrantyPeriodMonths))
                    : null;
                  const visits = [...a.serviceJobs].sort((x, y) => new Date(y.dueDate).getTime() - new Date(x.dueDate).getTime());
                  const title = `${a.product.name} — ${a.customer.name}`;
                  return (
                    <div key={a.id} className={`bg-white rounded-xl border ${next && jobOverdue(next) ? 'border-red-200' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <button onClick={() => setExpanded((e) => ({ ...e, [a.id]: !open }))} className="min-w-0 flex-1 text-left">
                          <p className="text-sm text-gray-500">
                            {a.customer.cardNo && <span className="mr-1 font-mono text-xs font-semibold text-blue-700">#{a.customer.cardNo}</span>}
                            <span className="font-semibold text-gray-900">{a.customer.name}</span> · {a.customer.phone}
                          </p>
                          <p className="font-medium text-gray-800">{a.product.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            <span className={`mr-1.5 rounded-full px-1.5 py-0.5 font-medium ${AMC_STATUS_STYLE[a.status]}`}>{a.status.replace('_', ' ')}</span>
                            {frequencyLabel(a.serviceFrequency, a.frequencyMonths)}
                            {warrantyEnd && ` · warranty till ${dateText(warrantyEnd.toISOString())}`}
                            {a.amcTo && ` · AMC till ${dateText(a.amcTo)}`}
                          </p>
                          {a.notes && <p className="mt-0.5 text-xs text-amber-700">{a.notes}</p>}
                        </button>
                        <div className="text-right">
                          {next ? (
                            <>
                              <p className={`text-sm font-semibold ${jobOverdue(next) ? 'text-red-600' : 'text-gray-800'}`}>
                                Next visit {dateText(next.dueDate)}{jobOverdue(next) ? ' · overdue' : ''}
                              </p>
                              <p className="text-xs text-gray-500">{next.assignedTo ? next.assignedTo.name : 'No technician yet'}</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">No visit scheduled</p>
                          )}
                          <button
                            onClick={() => setExpanded((e) => ({ ...e, [a.id]: !open }))}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700"
                          >
                            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {a.serviceJobs.length} visit{a.serviceJobs.length === 1 ? '' : 's'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t px-4 py-2">
                        <button onClick={() => setCardFor(a.id)} className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"><ShieldCheck className="h-3.5 w-3.5" /> Card</button>
                        <button onClick={() => setEditingAmc(a)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><Pencil className="h-3.5 w-3.5" /> Edit AMC</button>
                        {a.status === 'ACTIVE' && (
                          <button onClick={() => setAddingVisit(a)} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /> Add visit</button>
                        )}
                        {a.status === 'ACTIVE' ? (
                          <button onClick={() => setCancellingAmc(a)} className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" /> Cancel AMC</button>
                        ) : a.status === 'CANCELLED' ? (
                          <button onClick={() => setReactivatingAmc(a)} className="flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"><RotateCcw className="h-3.5 w-3.5" /> Reactivate</button>
                        ) : null}
                        <Link href={`/customers/${a.customer.id}`} className="ml-auto self-center text-xs text-gray-500 underline">Customer page</Link>
                      </div>

                      {open && (
                        <div className="border-t bg-gray-50 px-4 py-3">
                          <p className="mb-2 text-xs text-gray-500">The next regular visit is created automatically when the current one is closed.</p>
                          {visits.length === 0 ? (
                            <p className="text-sm text-gray-400">No visits yet</p>
                          ) : (
                            <div className="space-y-2">
                              {visits.map((j) => {
                                const full = withWarranty(a, j);
                                const closedJob = j.status === 'COMPLETED' || j.status === 'CANCELLED';
                                return (
                                  <div key={j.id} className="rounded-lg border bg-white p-3 text-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="font-medium">
                                          {dateText(j.dueDate)}
                                          <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${jobOverdue(j) ? 'bg-red-100 text-red-600' : JOB_STATUS_STYLE[j.status]}`}>
                                            {jobOverdue(j) ? 'OVERDUE' : j.status.replace('_', ' ')}
                                          </span>
                                          {j.isExtra && <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">extra</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {j.assignedTo ? j.assignedTo.name : 'Not assigned'}
                                          {j.visitDate && ` · visited ${dateText(j.visitDate)}`}
                                          {j.parts?.length > 0 && ` · parts: ${j.parts.map((p) => `${p.sku.product.name} × ${parseFloat(p.quantity)}`).join(', ')}`}
                                        </p>
                                        {j.customerFeedback && <p className="text-xs text-gray-600">&ldquo;{j.customerFeedback}&rdquo;</p>}
                                        {j.invoice && (
                                          <button onClick={() => handleViewInvoice(j.invoice!.id)} disabled={viewingInvoiceId === j.invoice.id} className="mt-0.5 inline-flex items-center gap-1 text-xs text-green-700 underline">
                                            <Receipt className="h-3 w-3" /> {j.invoice.billNo ? `Bill No. ${j.invoice.billNo}` : j.invoice.invoiceNumber} · ₹{parseFloat(j.invoice.totalAmount).toLocaleString('en-IN')}
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {!closedJob && (
                                          <>
                                            <button onClick={() => setAssigning(full)} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">{j.assignedTo ? 'Reassign' : 'Assign'}</button>
                                            <button onClick={() => setRescheduling(full)} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">Reschedule</button>
                                          </>
                                        )}
                                        {!j.invoice && j.status !== 'CANCELLED' && (
                                          <button onClick={() => router.push(`/billing/service-bill?jobId=${j.id}`)} className="rounded-lg border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50">Bill</button>
                                        )}
                                        <button onClick={() => setEditingVisit({ job: j, title })} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"><Pencil className="inline h-3 w-3" /> Edit</button>
                                        {!closedJob && !j.invoice && (
                                          <button onClick={() => setCancellingJob(full)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Cancel</button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {approving && <ApproveModal warranty={approving} onClose={() => setApproving(null)} onSaved={() => { setApproving(null); load(); }} />}
      {rejecting && <RejectModal warranty={rejecting} onClose={() => setRejecting(null)} onSaved={() => { setRejecting(null); load(); }} />}
      {approvingReq && <ApproveRequestModal request={approvingReq} staff={staff} onClose={() => setApprovingReq(null)} onSaved={() => { setApprovingReq(null); load(); }} />}
      {assigning && <AssignModal job={assigning} staff={staff} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); load(); }} />}
      {rescheduling && <RescheduleModal job={rescheduling} onClose={() => setRescheduling(null)} onSaved={() => { setRescheduling(null); load(); }} />}
      {cancellingJob && <CancelJobModal job={cancellingJob} onClose={() => setCancellingJob(null)} onSaved={() => { setCancellingJob(null); load(); }} />}
      {editingVisit && <VisitEditModal visit={editingVisit.job} staff={staff} title={editingVisit.title} onClose={() => setEditingVisit(null)} onSaved={() => { setEditingVisit(null); load(); }} />}
      {editingAmc && <AmcEditModal amc={editingAmc} onClose={() => setEditingAmc(null)} onSaved={() => { setEditingAmc(null); load(); }} />}
      {addingVisit && <AddVisitModal amc={addingVisit} staff={staff} onClose={() => setAddingVisit(null)} onSaved={() => { setAddingVisit(null); load(); }} />}
      {showAmcOnboard && <AmcOnboardModal onClose={() => setShowAmcOnboard(false)} onSaved={() => { setShowAmcOnboard(false); load(); }} />}
      {cardFor && <WarrantyCardModal warrantyId={cardFor} onClose={() => setCardFor(null)} onSaved={load} />}
      {reactivatingAmc && <ReactivateAmcModal warranty={reactivatingAmc} onClose={() => setReactivatingAmc(null)} onSaved={() => { setReactivatingAmc(null); load(); }} />}
      {cancellingAmc && <CancelAmcModal warranty={cancellingAmc} onClose={() => setCancellingAmc(null)} onSaved={() => { setCancellingAmc(null); load(); }} />}
    </div>
  );
}

function CancelAmcModal({ warranty, onClose, onSaved }: { warranty: Warranty; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}/cancel`);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to cancel this AMC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Cancel AMC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{warranty.product.name} — {warranty.customer.name}</p>
          <p className="text-sm text-gray-500">
            This stops recurring service visits for this AMC. You can undo this later from the Reactivate button.
          </p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Keep AMC</button>
          <button onClick={handleCancel} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Cancelling…' : 'Cancel AMC'}
          </button>
        </div>
      </div>
    </div>
  );
}


function ReactivateAmcModal({ warranty, onClose, onSaved }: { warranty: Warranty; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const wasApproved = warranty.warrantyPeriodMonths != null;

  const handleReactivate = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}/reactivate`);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to reactivate this AMC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Reactivate AMC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{warranty.product.name} — {warranty.customer.name}</p>
          <p className="text-sm text-gray-500">
            {wasApproved
              ? 'This undoes a mistaken cancellation — the AMC goes back to Active and resumes its recurring visits.'
              : 'This claim was never approved — reactivating sends it back to Pending Approval for review.'}
          </p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleReactivate} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Reactivating…' : 'Reactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelJobModal({ job, onClose, onSaved }: { job: ServiceJob; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/cancel`);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to cancel this job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Cancel Service Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{job.warranty.product.name} — {job.warranty.customer.name}</p>
          <p className="text-sm text-gray-500">
            This marks the job as cancelled — it won&apos;t show up as scheduled or overdue anymore. This can&apos;t be undone from here.
          </p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Keep Job</button>
          <button onClick={handleCancel} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Cancelling…' : 'Cancel Job'}
          </button>
        </div>
      </div>
    </div>
  );
}


function RejectModal({ warranty, onClose, onSaved }: { warranty: Warranty; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleReject = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}/cancel`);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Reject AMC Claim</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">
            {warranty.product.name} — {warranty.customer.name}
          </p>
          <p className="text-sm text-gray-500">
            This marks the claim as cancelled — no service jobs will be scheduled for it. This can't be undone from here.
          </p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleReject} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Rejecting…' : 'Reject Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ warranty, onClose, onSaved }: { warranty: Warranty; onClose: () => void; onSaved: () => void }) {
  const [months, setMonths] = useState('12');
  const [frequency, setFrequency] = useState('QUARTERLY');
  const [freqMonths, setFreqMonths] = useState('3');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}/approve`, {
        warrantyPeriodMonths: +months,
        serviceFrequency: frequency,
        ...(frequency === 'CUSTOM' ? { frequencyMonths: +freqMonths } : {}),
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Approve AMC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{warranty.product.name} — {warranty.customer.name}</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">AMC Period (months)</label>
            <input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service Frequency</label>
            <FrequencyPicker value={frequency} months={freqMonths} onChange={(v, mo) => { setFrequency(v); setFreqMonths(mo); }} />
          </div>
          <p className="text-xs text-gray-400">Service visits keep recurring on this frequency for as long as the AMC stays active — visits within the AMC period are typically free, later ones billable.</p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleApprove} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({ job, staff, onClose, onSaved }: { job: ServiceJob; staff: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [assignedToId, setAssignedToId] = useState(job.assignedTo?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAssign = async () => {
    if (!assignedToId) { setError('Pick a staff member.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/assign`, { assignedToId });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Assign Service Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {staff.length === 0 ? (
            <p className="text-sm text-gray-500">No active service staff yet — add one from Users first.</p>
          ) : (
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select staff…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAssign} disabled={saving || staff.length === 0} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ job, onClose, onSaved }: { job: ServiceJob; onClose: () => void; onSaved: () => void }) {
  const [dueDate, setDueDate] = useState(job.dueDate.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!dueDate) { setError('Pick a date.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/reschedule`, { dueDate });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Reschedule Service Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{job.warranty.product.name} — {job.warranty.customer.name}</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

