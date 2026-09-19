'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench, CheckCircle, UserPlus, Plus, CalendarClock, Search, Phone, MessageCircle, MapPin, XCircle, AlertTriangle, Receipt, Pencil, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';
import { AmcOnboardModal } from '@/components/service/AmcOnboardModal';

interface WarrantyCustomer { id: string; name: string; phone: string; address: string | null }
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
  status: 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedTo: { id: string; name: string } | null;
  customerChargeAmount: string | null;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; totalAmount: string } | null;
  parts: ServiceJobPart[];
  warranty: {
    customer: WarrantyCustomer;
    product: WarrantyProduct;
    invoiceItem: WarrantyInvoiceItem | null;
  };
}

const JOB_STATUS_STYLE: Record<string, string> = {
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
// 30 days ahead — so both screens open on "what's relevant right now"
// instead of every job/AMC ever created. Custom range overrides it.
const toDateInput = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
function defaultDateRange() {
  const from = new Date();
  from.setDate(from.getDate() - 15);
  const to = new Date();
  to.setDate(to.getDate() + 30);
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

export default function ServiceAdminPage() {
  const [tab, setTab] = useState<'pending' | 'jobs' | 'amcs'>('pending');
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [allWarranties, setAllWarranties] = useState<Warranty[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Warranty | null>(null);
  const [assigning, setAssigning] = useState<ServiceJob | null>(null);
  const [rescheduling, setRescheduling] = useState<ServiceJob | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showAmcOnboard, setShowAmcOnboard] = useState(false);
  const [rejecting, setRejecting] = useState<Warranty | null>(null);
  const [billing, setBilling] = useState<ServiceJob | null>(null);
  const [cancellingJob, setCancellingJob] = useState<ServiceJob | null>(null);
  const [editingAmc, setEditingAmc] = useState<Warranty | null>(null);
  const [reactivatingAmc, setReactivatingAmc] = useState<Warranty | null>(null);
  const [cancellingAmc, setCancellingAmc] = useState<Warranty | null>(null);
  const [jobQuery, setJobQuery] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'ALL' | 'OVERDUE' | ServiceJob['status']>('ALL');
  const [jobSort, setJobSort] = useState<'date' | 'customer' | 'product'>('date');
  const [jobDates, setJobDates] = useState(defaultDateRange);
  const [amcQuery, setAmcQuery] = useState('');
  const [amcStatusFilter, setAmcStatusFilter] = useState<'ALL' | Warranty['status']>('ALL');
  const [amcSort, setAmcSort] = useState<'date' | 'customer' | 'product'>('date');
  const [amcDates, setAmcDates] = useState(defaultDateRange);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, all, j, u] = await Promise.all([
        api.get('/warranty', { params: { status: 'PENDING_APPROVAL' } }),
        api.get('/warranty'),
        api.get('/warranty/service-jobs'),
        api.get('/users'),
      ]);
      setWarranties(w.data);
      setAllWarranties(all.data);
      setJobs(j.data);
      setStaff(u.data.filter((usr: any) => usr.role === 'SERVICE_STAFF' && usr.isActive));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isOverdue = (j: ServiceJob) =>
    j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && new Date(j.dueDate) < new Date();

  // Parts used carry their own price/tax snapshot; the labor/visit charge is
  // the flat customerChargeAmount staff enters — billing combines both.
  const jobBillTotal = (j: ServiceJob) => {
    const partsTotal = (j.parts || []).reduce((s, p) => {
      const line = parseFloat(p.unitPrice) * parseFloat(p.quantity);
      return s + line + (line * parseFloat(p.taxRate)) / 100;
    }, 0);
    return partsTotal + parseFloat(j.customerChargeAmount || '0');
  };

  const visibleJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    const from = jobDates.from ? new Date(jobDates.from + 'T00:00:00') : null;
    const to = jobDates.to ? new Date(jobDates.to + 'T23:59:59') : null;
    const filtered = jobs.filter((j) => {
      if (jobStatusFilter === 'OVERDUE' && !isOverdue(j)) return false;
      if (jobStatusFilter !== 'ALL' && jobStatusFilter !== 'OVERDUE' && j.status !== jobStatusFilter) return false;
      const due = new Date(j.dueDate);
      if (from && due < from) return false;
      if (to && due > to) return false;
      if (!q) return true;
      return (
        j.warranty.customer.name.toLowerCase().includes(q) ||
        j.warranty.customer.phone.includes(q) ||
        j.warranty.product.name.toLowerCase().includes(q) ||
        (j.assignedTo?.name.toLowerCase().includes(q) ?? false)
      );
    });
    return [...filtered].sort((a, b) => {
      if (jobSort === 'customer') return a.warranty.customer.name.localeCompare(b.warranty.customer.name);
      if (jobSort === 'product') return a.warranty.product.name.localeCompare(b.warranty.product.name);
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [jobs, jobQuery, jobStatusFilter, jobSort, jobDates]);

  const overdueCount = jobs.filter(isOverdue).length;

  const visibleAmcs = useMemo(() => {
    const q = amcQuery.trim().toLowerCase();
    const from = amcDates.from ? new Date(amcDates.from + 'T00:00:00') : null;
    const to = amcDates.to ? new Date(amcDates.to + 'T23:59:59') : null;
    const filtered = allWarranties.filter((w) => {
      if (amcStatusFilter !== 'ALL' && w.status !== amcStatusFilter) return false;
      // AMCs with no next-service date (pending claims, or ones never
      // approved) aren't date-scoped the same way a job is — hiding them
      // behind a date window would bury something that needs review.
      if (w.nextServiceDueAt) {
        const due = new Date(w.nextServiceDueAt);
        if (from && due < from) return false;
        if (to && due > to) return false;
      }
      if (!q) return true;
      return (
        w.customer.name.toLowerCase().includes(q) ||
        w.customer.phone.includes(q) ||
        w.product.name.toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (amcSort === 'customer') return a.customer.name.localeCompare(b.customer.name);
      if (amcSort === 'product') return a.product.name.localeCompare(b.product.name);
      const aDue = a.nextServiceDueAt ? new Date(a.nextServiceDueAt).getTime() : Infinity;
      const bDue = b.nextServiceDueAt ? new Date(b.nextServiceDueAt).getTime() : Infinity;
      return aDue - bDue;
    });
  }, [allWarranties, amcQuery, amcStatusFilter, amcSort, amcDates]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="h-5 w-5 text-red-700" /> Service</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAmcOnboard(true)}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Register AMC</span>
            </button>
            {tab === 'jobs' && (
              <button
                onClick={() => setShowCreateJob(true)}
                className="flex items-center gap-2 px-3 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
              >
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Service Job</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-red-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Pending Approval {warranties.length > 0 && `(${warranties.length})`}
          </button>
          <button
            onClick={() => setTab('jobs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'jobs' ? 'bg-red-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Service Jobs
            {overdueCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === 'jobs' ? 'bg-white/20' : 'bg-red-100 text-red-600'}`}>
                {overdueCount} overdue
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('amcs')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'amcs' ? 'bg-red-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            All AMCs
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : tab === 'pending' ? (
          warranties.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <CheckCircle className="h-10 w-10 opacity-40" />
              <p>No AMC claims waiting for approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {warranties.map((w) => {
                const serial = w.invoiceItem?.serialUnits?.[0]?.serialNumber;
                return (
                  <div key={w.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {w.product.name}
                        {serial && <span className="ml-2 text-xs font-mono text-gray-400">S/N {serial}</span>}
                      </p>
                      <p className="text-sm text-gray-500">{w.customer.name} · {w.customer.phone}</p>
                      <ContactLinks customer={w.customer} />
                      <p className="text-xs text-gray-400 mt-1">Sold {new Date(w.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setRejecting(w)}
                        className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50"
                        title="Reject this AMC claim"
                      >
                        <XCircle className="h-4 w-4" /> <span className="hidden sm:inline">Reject</span>
                      </button>
                      <button
                        onClick={() => setApproving(w)}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === 'jobs' ? (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                  placeholder="Search by customer, phone, product, or technician…"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">All statuses</option>
                <option value="OVERDUE">Overdue</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={jobSort}
                onChange={(e) => setJobSort(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="date">Sort: Due Date</option>
                <option value="customer">Sort: Customer</option>
                <option value="product">Sort: Product</option>
              </select>
            </div>
            <div className="mb-4">
              <DateRangeFilter
                from={jobDates.from}
                to={jobDates.to}
                onChange={(from, to) => setJobDates({ from, to })}
                onReset={() => setJobDates(defaultDateRange())}
              />
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Wrench className="h-10 w-10 opacity-40" />
                <p>No service jobs yet</p>
              </div>
            ) : visibleJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Search className="h-10 w-10 opacity-40" />
                <p>No jobs match your search/filter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleJobs.map((j) => {
                  const overdue = isOverdue(j);
                  const serial = j.warranty.invoiceItem?.serialUnits?.[0]?.serialNumber;
                  return (
              <div key={j.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 ${overdue ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {j.warranty.product.name}
                    {serial && <span className="ml-2 text-xs font-mono text-gray-400">S/N {serial}</span>}
                  </p>
                  <p className="text-sm text-gray-500">{j.warranty.customer.name} · {j.warranty.customer.phone}</p>
                  <ContactLinks customer={j.warranty.customer} />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${JOB_STATUS_STYLE[j.status]}`}>{j.status.replace('_', ' ')}</span>
                    {overdue && (
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </span>
                    )}
                    <span className="text-xs text-gray-400">Due {new Date(j.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                    {j.assignedTo && <span className="text-xs text-gray-500">· {j.assignedTo.name}</span>}
                    {j.parts?.length > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                        {j.parts.length} part{j.parts.length > 1 ? 's' : ''} used
                      </span>
                    )}
                    {j.invoice ? (
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                        <Receipt className="h-3 w-3" /> {j.invoice.invoiceNumber}
                      </span>
                    ) : jobBillTotal(j) > 0 ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        ₹{jobBillTotal(j).toLocaleString('en-IN')} not yet billed
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {!j.invoice && jobBillTotal(j) > 0 && (
                    <button
                      onClick={() => setBilling(j)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      <Receipt className="h-4 w-4" /> <span className="hidden sm:inline">Bill Customer</span>
                    </button>
                  )}
                  {j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && (
                    <>
                      <button
                        onClick={() => setRescheduling(j)}
                        className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <CalendarClock className="h-4 w-4" /> <span className="hidden sm:inline">Reschedule</span>
                      </button>
                      <button
                        onClick={() => setAssigning(j)}
                        className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <UserPlus className="h-4 w-4" /> {j.assignedTo ? 'Reassign' : 'Assign'}
                      </button>
                      <button
                        onClick={() => setCancellingJob(j)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                        title="Cancel this job"
                      >
                        <XCircle className="h-4 w-4" /> <span className="hidden sm:inline">Cancel</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={amcQuery}
                  onChange={(e) => setAmcQuery(e.target.value)}
                  placeholder="Search by customer, phone, or product…"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <select
                value={amcStatusFilter}
                onChange={(e) => setAmcStatusFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={amcSort}
                onChange={(e) => setAmcSort(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="date">Sort: Next Service Date</option>
                <option value="customer">Sort: Customer</option>
                <option value="product">Sort: Product</option>
              </select>
            </div>
            <div className="mb-4">
              <DateRangeFilter
                from={amcDates.from}
                to={amcDates.to}
                onChange={(from, to) => setAmcDates({ from, to })}
                onReset={() => setAmcDates(defaultDateRange())}
              />
              <p className="text-xs text-gray-400 mt-1">Pending or not-yet-scheduled AMCs always show, regardless of this range.</p>
            </div>

            {allWarranties.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Wrench className="h-10 w-10 opacity-40" />
                <p>No AMCs yet</p>
              </div>
            ) : visibleAmcs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Search className="h-10 w-10 opacity-40" />
                <p>No AMCs match your search/filter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAmcs.map((w) => {
                  const serial = w.invoiceItem?.serialUnits?.[0]?.serialNumber;
                  return (
                    <div key={w.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {w.product.name}
                          {serial && <span className="ml-2 text-xs font-mono text-gray-400">S/N {serial}</span>}
                        </p>
                        <p className="text-sm text-gray-500">{w.customer.name} · {w.customer.phone}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${AMC_STATUS_STYLE[w.status]}`}>
                            {w.status.replace('_', ' ')}
                          </span>
                          {w.status === 'ACTIVE' && (
                            <span className="text-xs text-gray-400">
                              {w.warrantyPeriodMonths} mo · {w.serviceFrequency?.replace('_', ' ').toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {w.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => setEditingAmc(w)}
                              className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              onClick={() => setCancellingAmc(w)}
                              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" /> <span className="hidden sm:inline">Cancel</span>
                            </button>
                          </>
                        )}
                        {w.status === 'CANCELLED' && (
                          <button
                            onClick={() => setReactivatingAmc(w)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-green-200 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50"
                          >
                            <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Reactivate</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {approving && (
        <ApproveModal
          warranty={approving}
          onClose={() => setApproving(null)}
          onSaved={() => { setApproving(null); load(); }}
        />
      )}
      {assigning && (
        <AssignModal
          job={assigning}
          staff={staff}
          onClose={() => setAssigning(null)}
          onSaved={() => { setAssigning(null); load(); }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          job={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => { setRescheduling(null); load(); }}
        />
      )}
      {showCreateJob && (
        <CreateJobModal
          onClose={() => setShowCreateJob(false)}
          onSaved={() => { setShowCreateJob(false); load(); }}
        />
      )}
      {showAmcOnboard && (
        <AmcOnboardModal
          onClose={() => setShowAmcOnboard(false)}
          onSaved={() => { setShowAmcOnboard(false); load(); }}
        />
      )}
      {rejecting && (
        <RejectModal
          warranty={rejecting}
          onClose={() => setRejecting(null)}
          onSaved={() => { setRejecting(null); load(); }}
        />
      )}
      {billing && (
        <BillModal
          job={billing}
          onClose={() => setBilling(null)}
          onSaved={() => { setBilling(null); load(); }}
        />
      )}
      {cancellingJob && (
        <CancelJobModal
          job={cancellingJob}
          onClose={() => setCancellingJob(null)}
          onSaved={() => { setCancellingJob(null); load(); }}
        />
      )}
      {editingAmc && (
        <EditAmcModal
          warranty={editingAmc}
          onClose={() => setEditingAmc(null)}
          onSaved={() => { setEditingAmc(null); load(); }}
        />
      )}
      {reactivatingAmc && (
        <ReactivateAmcModal
          warranty={reactivatingAmc}
          onClose={() => setReactivatingAmc(null)}
          onSaved={() => { setReactivatingAmc(null); load(); }}
        />
      )}
      {cancellingAmc && (
        <CancelAmcModal
          warranty={cancellingAmc}
          onClose={() => setCancellingAmc(null)}
          onSaved={() => { setCancellingAmc(null); load(); }}
        />
      )}
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

function EditAmcModal({ warranty, onClose, onSaved }: { warranty: Warranty; onClose: () => void; onSaved: () => void }) {
  const [months, setMonths] = useState(String(warranty.warrantyPeriodMonths ?? '12'));
  const [frequency, setFrequency] = useState(warranty.serviceFrequency ?? 'QUARTERLY');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}`, { warrantyPeriodMonths: +months, serviceFrequency: frequency });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update AMC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Edit AMC</h2>
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
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Every 3 months</option>
              <option value="HALF_YEARLY">Every 6 months</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">Changes apply going forward — a visit already scheduled keeps its current due date.</p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
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

function BillModal({ job, onClose, onSaved }: { job: ServiceJob; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'EMI'>('CASH');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const partsTotal = (job.parts || []).reduce((s, p) => {
    const line = parseFloat(p.unitPrice) * parseFloat(p.quantity);
    return s + line + (line * parseFloat(p.taxRate)) / 100;
  }, 0);
  const laborCharge = parseFloat(job.customerChargeAmount || '0');
  const amount = partsTotal + laborCharge;

  const handleBill = async () => {
    setError('');
    setSaving(true);
    try {
      const { data } = await api.patch(`/warranty/service-jobs/${job.id}/bill`, {
        payments: [{ mode, amount }],
      });
      printReceipt(data);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to bill this job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Bill Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <p className="text-sm text-gray-600">{job.warranty.product.name} — {job.warranty.customer.name}</p>
          {job.parts?.length > 0 && (
            <div className="border rounded-lg divide-y text-sm">
              {job.parts.map((p) => (
                <div key={p.id} className="flex justify-between px-3 py-1.5">
                  <span>{p.sku.product.name} × {p.quantity}</span>
                  <span>₹{(parseFloat(p.unitPrice) * parseFloat(p.quantity)).toLocaleString('en-IN')}</span>
                </div>
              ))}
              {laborCharge > 0 && (
                <div className="flex justify-between px-3 py-1.5">
                  <span>Visit / labor charge</span>
                  <span>₹{laborCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-baseline border-t pt-3">
            <span className="text-sm text-gray-500">Total to bill</span>
            <span className="text-xl font-bold text-gray-900">₹{amount.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="EMI">EMI</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">This creates a real GST invoice and payment record for this visit, and prints a receipt.</p>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleBill} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Billing…' : 'Generate Invoice'}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setError('');
    setSaving(true);
    try {
      await api.patch(`/warranty/${warranty.id}/approve`, { warrantyPeriodMonths: +months, serviceFrequency: frequency });
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
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Every 3 months</option>
              <option value="HALF_YEARLY">Every 6 months</option>
              <option value="YEARLY">Yearly</option>
            </select>
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

function CreateJobModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [activeWarranties, setActiveWarranties] = useState<Warranty[]>([]);
  const [loadingWarranties, setLoadingWarranties] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Warranty | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/warranty', { params: { status: 'ACTIVE' } })
      .then(({ data }) => setActiveWarranties(data))
      .finally(() => setLoadingWarranties(false));
  }, []);

  const matches = activeWarranties.filter((w) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      w.customer.name.toLowerCase().includes(q) ||
      w.customer.phone.includes(q) ||
      w.product.name.toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!selected) { setError('Pick a customer / product under AMC.'); return; }
    if (!dueDate) { setError('Pick a due date.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/warranty/service-jobs', { warrantyId: selected.id, dueDate });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create service job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">New Service Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          {selected ? (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-red-900">{selected.product.name}</p>
                <p className="text-xs text-red-600">{selected.customer.name} · {selected.customer.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-red-400 hover:text-red-700 text-xl leading-none">&times;</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by customer name, phone, or product…"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="border rounded-lg divide-y max-h-52 overflow-auto">
                {loadingWarranties ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Loading…</p>
                ) : matches.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">
                    {activeWarranties.length === 0
                      ? 'No active AMCs yet — approve one from Pending Approval, or Register AMC, first.'
                      : 'No matches.'}
                  </p>
                ) : (
                  matches.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setSelected(w)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      <p className="font-medium text-gray-900">{w.product.name}</p>
                      <p className="text-xs text-gray-500">{w.customer.name} · {w.customer.phone}</p>
                      <p className="text-xs text-gray-400">Purchased {new Date(w.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
