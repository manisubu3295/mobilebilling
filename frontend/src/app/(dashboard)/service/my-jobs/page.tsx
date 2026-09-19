'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wrench, MapPin, MessageSquare, IndianRupee, CheckCircle2, Phone, MessageCircle, Receipt, Package, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { printReceipt } from '@/lib/print-receipt';

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
  invoice: { id: string; invoiceNumber: string; totalAmount: string } | null;
  parts: ServiceJobPart[];
  warranty: {
    customer: { name: string; phone: string; address: string | null };
    product: { name: string };
    invoiceItem: { serialUnits?: { serialNumber: string | null }[] } | null;
  };
}

const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;

function ContactRow({ customer }: { customer: { phone: string; address: string | null } }) {
  return (
    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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

export default function MyServiceJobsPage() {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ServiceJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/warranty/service-jobs/my');
      setJobs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = jobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const history = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'CANCELLED');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="h-5 w-5 text-red-700" /> My Service Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">{active.length} active</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : (
          <>
            {active.length === 0 && history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Wrench className="h-10 w-10 opacity-40" />
                <p>No service jobs assigned to you</p>
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
          <p className="text-sm text-gray-500">{job.warranty.customer.name} · {job.warranty.customer.phone}</p>
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
  const [visitDate, setVisitDate] = useState(job.visitDate ? job.visitDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState(job.customerFeedback || '');
  const [staffExpense, setStaffExpense] = useState(job.staffExpenseAmount || '');
  const [staffExpenseNotes, setStaffExpenseNotes] = useState(job.staffExpenseNotes || '');
  const [customerCharge, setCustomerCharge] = useState(job.customerChargeAmount || '');
  const [customerChargeNotes, setCustomerChargeNotes] = useState(job.customerChargeNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [billMode, setBillMode] = useState<'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'EMI'>('CASH');
  const [billing, setBilling] = useState(false);

  const [parts, setParts] = useState<ServiceJobPart[]>(job.parts || []);
  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<any[]>([]);
  const [partSearching, setPartSearching] = useState(false);
  const [partQty, setPartQty] = useState('1');
  const [addingPart, setAddingPart] = useState(false);

  const closed = job.status === 'COMPLETED' || job.status === 'CANCELLED';
  const savedChargeAmount = parseFloat(job.customerChargeAmount || '0');
  const partsTotal = parts.reduce((s, p) => {
    const line = parseFloat(p.unitPrice) * parseFloat(p.quantity);
    return s + line + (line * parseFloat(p.taxRate)) / 100;
  }, 0);
  const billTotal = savedChargeAmount + partsTotal;

  useEffect(() => {
    if (partQuery.trim().length < 2) { setPartResults([]); return; }
    setPartSearching(true);
    const t = setTimeout(() => {
      api.get('/billing/lookup/search', { params: { q: partQuery } })
        .then(({ data }) => setPartResults(data))
        .finally(() => setPartSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [partQuery]);

  const handleAddPart = async (r: any) => {
    if (!r.found || r.type === 'serial') return; // serialized parts aren't supported yet
    setError('');
    setAddingPart(true);
    try {
      const { data } = await api.post(`/warranty/service-jobs/${job.id}/parts`, {
        skuId: r.skuId,
        quantity: parseFloat(partQty) || 1,
      });
      setParts((p) => [...p, data]);
      setPartQuery('');
      setPartResults([]);
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
      const { data } = await api.patch(`/warranty/service-jobs/${job.id}/bill`, {
        payments: [{ mode: billMode, amount: billTotal }],
      });
      printReceipt(data);
      onSaved();
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
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={partQuery}
                      onChange={(e) => setPartQuery(e.target.value)}
                      placeholder="Search part to add…"
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <input
                    type="number"
                    min={0.001}
                    step="0.001"
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    className="w-16 border rounded-lg px-2 py-2 text-sm text-center"
                  />
                </div>
                {partQuery.trim().length >= 2 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
                    {partSearching && <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>}
                    {!partSearching && partResults.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
                    {partResults.map((r, i) => {
                      const disabled = !r.found || r.type === 'serial' || addingPart;
                      return (
                        <button
                          key={i}
                          onClick={() => handleAddPart(r)}
                          disabled={disabled}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 text-sm ${disabled ? 'opacity-50' : ''}`}
                        >
                          <span>
                            {r.productName} <span className="text-gray-400">· {r.variantName}</span>
                            {r.type === 'serial' && <span className="text-gray-400"> (serial-tracked — not supported here)</span>}
                          </span>
                          <span className="font-semibold text-red-700 shrink-0">₹{parseFloat(r.sellingPrice).toFixed(0)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                Billed — {job.invoice.invoiceNumber} · ₹{parseFloat(job.invoice.totalAmount).toLocaleString('en-IN')}
              </span>
            </div>
          ) : billTotal > 0 ? (
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <p className="text-xs font-medium text-gray-600">
                Bill {parts.length > 0 && `${parts.length} part(s)`}{parts.length > 0 && savedChargeAmount > 0 && ' + '}{savedChargeAmount > 0 && 'visit charge'} — ₹{billTotal.toLocaleString('en-IN')} total
              </p>
              <div className="flex gap-2">
                <select value={billMode} onChange={(e) => setBillMode(e.target.value as any)} className="flex-1 border rounded-lg px-2 py-2 text-sm bg-white">
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="EMI">EMI</option>
                </select>
                <button
                  onClick={handleBill}
                  disabled={billing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" /> {billing ? 'Billing…' : 'Bill'}
                </button>
              </div>
            </div>
          ) : null}

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
