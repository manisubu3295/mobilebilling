'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, MapPin, MessageSquare, IndianRupee, CheckCircle2, Phone, MessageCircle, Receipt, Package, Search, X, CalendarPlus } from 'lucide-react';
import api from '@/lib/api';
import { localDateString } from '@/lib/local-date';
import { SparePicker, SpareResult } from '@/components/service/SparePicker';
import { ScheduleServiceModal } from '@/components/service/ScheduleServiceModal';

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
  status: 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  customerFeedback: string | null;
  staffExpenseAmount: string | null;
  staffExpenseNotes: string | null;
  customerChargeAmount: string | null;
  customerChargeNotes: string | null;
  closedAt: string | null;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; billNo?: string | null; totalAmount: string } | null;
  parts: ServiceJobPart[];
  warranty: {
    customer: { name: string; phone: string; address: string | null; cardNo?: string | null };
    product: { name: string };
    invoiceItem: { serialUnits?: { serialNumber: string | null }[] } | null;
  };
}

const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;

function ContactRow({ customer }: { customer: { phone: string; address: string | null } }) {
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <a href={`tel:${customer.phone}`} onClick={(e) => e.stopPropagation()} className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-blue-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
        <Phone className="h-4 w-4" /> Call
      </a>
      <a href={waHref(customer.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-green-200 px-3 text-sm font-medium text-green-700 hover:bg-green-50">
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      {customer.address && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(customer.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-gray-500 hover:underline truncate"
          title={customer.address}
        >
          <MapPin className="h-3 w-3 shrink-0" /> {customer.address}
        </a>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-gray-100 text-gray-600',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

type DateFilter = 'TODAY' | 'WEEK' | 'ALL' | 'CUSTOM';

interface ServiceRequest {
  id: string;
  dueDate: string;
  status: string;
  requestNote: string | null;
  reviewNote: string | null;
  createdAt: string;
  warranty: { customer: { name: string; cardNo?: string | null }; product: { name: string } };
}

const REQUEST_LABEL: Record<string, { text: string; tone: string }> = {
  REQUESTED: { text: 'Waiting for approval', tone: 'bg-amber-100 text-amber-700' },
  CANCELLED: { text: 'Not approved', tone: 'bg-red-100 text-red-600' },
};

export default function MyServiceJobsPage() {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ServiceJob | null>(null);
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [from, setFrom] = useState(localDateString());
  const [to, setTo] = useState(localDateString());
  const [scheduling, setScheduling] = useState(false);
  const [sentMsg, setSentMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, reqs] = await Promise.all([
        api.get('/warranty/service-jobs/my'),
        api.get('/warranty/service-requests/my').catch(() => ({ data: [] })),
      ]);
      setJobs(data);
      setRequests(reqs.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const matches = (j: ServiceJob) =>
    !q ||
    j.warranty.customer.name.toLowerCase().includes(q) ||
    j.warranty.customer.phone.includes(q) ||
    (j.warranty.customer.cardNo || '').toLowerCase() === q ||
    j.warranty.product.name.toLowerCase().includes(q);

  // Date filter: open visits by due date (overdue always shown for Today /
  // This week), finished ones by the visit / close date.
  const today = localDateString();
  const weekEnd = localDateString(new Date(Date.now() + 6 * 86400000));
  const inRange = (j: ServiceJob, isOpen: boolean) => {
    if (dateFilter === 'ALL') return true;
    const d = localDateString(new Date(isOpen ? j.dueDate : j.visitDate || j.closedAt || j.dueDate));
    if (dateFilter === 'TODAY') return isOpen ? d <= today : d === today;
    if (dateFilter === 'WEEK') return isOpen ? d <= weekEnd : d >= localDateString(new Date(Date.now() - 6 * 86400000)) && d <= today;
    return d >= from && d <= to;
  };
  const isClosed = (j: ServiceJob) => j.status === 'COMPLETED' || j.status === 'CANCELLED';
  const active = jobs.filter((j) => !isClosed(j) && matches(j) && inRange(j, true));
  const history = jobs.filter((j) => isClosed(j) && matches(j) && inRange(j, false));
  const openRequests = requests.filter((r) => r.status === 'REQUESTED' || (r.status === 'CANCELLED' && r.reviewNote));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="h-5 w-5 text-red-700" /> My Service Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">{active.length} to do</p>
          </div>
          <button
            onClick={() => setScheduling(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            <CalendarPlus className="h-4 w-4" /> Schedule a service
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, card no or product…"
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {([['TODAY', 'Today'], ['WEEK', 'This week'], ['ALL', 'All'], ['CUSTOM', 'Custom']] as [DateFilter, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setDateFilter(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${dateFilter === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {l}
            </button>
          ))}
          {dateFilter === 'CUSTOM' && (
            <span className="flex items-center gap-1 text-xs">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-1.5 py-1" />
              to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-1.5 py-1" />
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {sentMsg && <p className="rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-800">{sentMsg}</p>}
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : (
          <>
            {openRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">My requests</p>
                {openRequests.map((r) => (
                  <div key={r.id} className="rounded-xl border bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{r.warranty.product.name}</p>
                        <p className="text-gray-500">
                          {r.warranty.customer.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{r.warranty.customer.cardNo}</span>}
                          {r.warranty.customer.name} · {new Date(r.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </p>
                        {r.reviewNote && <p className="text-xs text-red-600">Admin: {r.reviewNote}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REQUEST_LABEL[r.status]?.tone}`}>{REQUEST_LABEL[r.status]?.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {active.length === 0 && history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Wrench className="h-10 w-10 opacity-40" />
                <p>{q || dateFilter !== 'ALL' ? 'No jobs match these filters' : 'No service jobs assigned to you'}</p>
              </div>
            )}
            {active.map((j) => (
              <JobCard key={j.id} job={j} onClick={() => setOpen(j)} />
            ))}
            {history.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">History</p>
                {history.map((j) => (
                  <JobCard key={j.id} job={j} onClick={() => setOpen(j)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {open && (
        <JobDetailSheet
          job={open}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load(); }}
        />
      )}
      {scheduling && (
        <ScheduleServiceModal
          onClose={() => setScheduling(false)}
          onSent={() => { setScheduling(false); setSentMsg('Request sent — you\'ll see it here once the admin approves it.'); load(); }}
        />
      )}
    </div>
  );
}

function JobCard({ job, onClick }: { job: ServiceJob; onClick: () => void }) {
  const overdue = job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && new Date(job.dueDate) < new Date();
  return (
    <button onClick={onClick} className="w-full bg-white rounded-xl border p-4 text-left hover:border-red-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            {job.warranty.product.name}
            {job.warranty.invoiceItem?.serialUnits?.[0]?.serialNumber && (
              <span className="ml-2 text-xs font-mono text-gray-400">S/N {job.warranty.invoiceItem?.serialUnits[0].serialNumber}</span>
            )}
          </p>
          <p className="text-sm text-gray-500">
            {job.warranty.customer.cardNo && <span className="mr-1 font-mono text-xs font-semibold text-blue-700">#{job.warranty.customer.cardNo}</span>}
            {job.warranty.customer.name} · {job.warranty.customer.phone}
          </p>
          <ContactRow customer={job.warranty.customer} />
          <p className={`text-xs mt-1.5 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
            Due {new Date(job.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}{overdue ? ' · Overdue' : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[job.status]}`}>{job.status.replace('_', ' ')}</span>
          {job.invoice ? (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
              <Receipt className="h-3 w-3" /> Billed
            </span>
          ) : (job.customerChargeAmount && parseFloat(job.customerChargeAmount) > 0) || job.parts?.length > 0 ? (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Not billed</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function JobDetailSheet({ job, onClose, onSaved }: { job: ServiceJob; onClose: () => void; onSaved: () => void }) {
  const [visitDate, setVisitDate] = useState(job.visitDate ? job.visitDate.slice(0, 10) : localDateString());
  const [feedback, setFeedback] = useState(job.customerFeedback || '');
  const [staffExpense, setStaffExpense] = useState(job.staffExpenseAmount || '');
  const [staffExpenseNotes, setStaffExpenseNotes] = useState(job.staffExpenseNotes || '');
  const [customerCharge, setCustomerCharge] = useState(job.customerChargeAmount || '');
  const [customerChargeNotes, setCustomerChargeNotes] = useState(job.customerChargeNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState(false);
  const router = useRouter();

  const [parts, setParts] = useState<ServiceJobPart[]>(job.parts || []);
  const [partQty, setPartQty] = useState('1');
  const [addingPart, setAddingPart] = useState(false);

  const closed = job.status === 'COMPLETED' || job.status === 'CANCELLED';
  const savedChargeAmount = parseFloat(job.customerChargeAmount || '0');
  const partsTotal = parts.reduce((s, p) => {
    const line = parseFloat(p.unitPrice) * parseFloat(p.quantity);
    return s + line + (line * parseFloat(p.taxRate)) / 100;
  }, 0);
  const billTotal = savedChargeAmount + partsTotal;

  const handleAddPart = async (r: SpareResult) => {
    if (!r.found || r.type === 'serial') return; // serialized parts aren't supported yet
    setError('');
    setAddingPart(true);
    try {
      const { data } = await api.post(`/warranty/service-jobs/${job.id}/parts`, {
        skuId: r.skuId,
        quantity: parseFloat(partQty) || 1,
      });
      setParts((p) => [...p, data]);
      setPartQty('1');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to add part');
    } finally {
      setAddingPart(false);
    }
  };

  const handleRemovePart = async (partId: string) => {
    setError('');
    try {
      await api.delete(`/warranty/service-jobs/${job.id}/parts/${partId}`);
      setParts((p) => p.filter((x) => x.id !== partId));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to remove part');
    }
  };

  const handleBill = async () => {
    setError('');
    setBilling(true);
    try {
      // Persist the visit date/feedback/expense fields first — billing only
      // submits payment info, so without this the technician's notes never
      // reach the server if they go straight to Bill without Save Progress.
      await api.patch(`/warranty/service-jobs/${job.id}/update`, buildPayload());
      // Billing happens on the full Service Bill page (bill no, service
      // type, TDS, extra lines, charges, payment, print).
      router.push(`/billing/service-bill?jobId=${job.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to bill this job');
    } finally {
      setBilling(false);
    }
  };

  const buildPayload = () => ({
    visitDate: visitDate || undefined,
    customerFeedback: feedback || undefined,
    staffExpenseAmount: staffExpense ? parseFloat(staffExpense) : undefined,
    staffExpenseNotes: staffExpenseNotes || undefined,
    customerChargeAmount: customerCharge ? parseFloat(customerCharge) : undefined,
    customerChargeNotes: customerChargeNotes || undefined,
  });

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/update`, buildPayload());
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/close`, buildPayload());
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to close job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{job.warranty.product.name}</h2>
            <p className="text-sm text-gray-500">{job.warranty.customer.name} · {job.warranty.customer.phone}</p>
            <ContactRow customer={job.warranty.customer} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1"><MapPin className="h-3.5 w-3.5" /> Visit Date</label>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} disabled={closed} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1"><MessageSquare className="h-3.5 w-3.5" /> Customer Feedback</label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={closed} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1"><Package className="h-3.5 w-3.5" /> Parts Used</label>
            {parts.length > 0 && (
              <div className="border rounded-lg divide-y mb-2">
                {parts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{p.sku.product.name}</p>
                      <p className="text-xs text-gray-500">{p.sku.variantName} · {p.quantity} {p.sku.unit} × ₹{parseFloat(p.unitPrice).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">₹{(parseFloat(p.unitPrice) * parseFloat(p.quantity)).toLocaleString('en-IN')}</span>
                      {!closed && (
                        <button onClick={() => handleRemovePart(p.id)} className="text-gray-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!closed && (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <SparePicker onPick={handleAddPart} disabled={addingPart} />
                </div>
                <label className="w-16 shrink-0">
                  <input
                    type="number"
                    min={0.001}
                    step="0.001"
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    className="w-full border rounded-lg px-2 py-2 text-sm text-center"
                    aria-label="Quantity"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1"><IndianRupee className="h-3.5 w-3.5" /> Your Expense</label>
              <input type="number" min={0} value={staffExpense} onChange={(e) => setStaffExpense(e.target.value)} disabled={closed} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Expense Notes</label>
              <input type="text" value={staffExpenseNotes} onChange={(e) => setStaffExpenseNotes(e.target.value)} disabled={closed} placeholder="Travel, parts…" className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Charged to Customer</label>
              <input type="number" min={0} value={customerCharge} onChange={(e) => setCustomerCharge(e.target.value)} disabled={closed} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Charge Notes</label>
              <input type="text" value={customerChargeNotes} onChange={(e) => setCustomerChargeNotes(e.target.value)} disabled={closed} placeholder="Paid visit…" className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
            </div>
          </div>

          {job.invoice ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Receipt className="h-4 w-4 text-green-700 shrink-0" />
              <span className="text-sm text-green-800 font-medium">
                Billed — {job.invoice.billNo ? `Bill No. ${job.invoice.billNo}` : job.invoice.invoiceNumber} · ₹{parseFloat(job.invoice.totalAmount).toLocaleString('en-IN')}
              </span>
            </div>
          ) : (
            <button
              onClick={handleBill}
              disabled={billing}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              <Receipt className="h-4 w-4" /> {billing ? 'Saving…' : `Bill customer${billTotal > 0 ? ` — ₹${billTotal.toLocaleString('en-IN')}` : ''}`}
            </button>
          )}

          {!closed ? (
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Save Progress
              </button>
              <button onClick={handleClose} disabled={saving} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Close Visit
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${STATUS_STYLE[job.status]}`}>
                {job.status === 'COMPLETED' ? `Closed ${job.closedAt ? new Date(job.closedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}` : job.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
