'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarCheck, Plus, Printer, Search, Trash2, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { CustomerSearch } from '@/components/billing/CustomerSearch';
import { RecentBills } from '@/components/billing/RecentBills';
import { printReceipt } from '@/lib/print-receipt';
import { useAuthStore } from '@/store/auth.store';

// Mirrors the technician's paper service bill: bill no (typed in for an
// existing paper bill, or the next number), technician, service type tick
// boxes, TDS readings, spares used, re-installation + service charges.

type ServiceCategory = 'WARRANTY' | 'OUT_OF_WARRANTY' | 'OTHER_SERVICE' | 'IRF' | 'AMC';
type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD';

const CATEGORIES: Array<[ServiceCategory, string]> = [
  ['WARRANTY', 'Warranty'],
  ['OUT_OF_WARRANTY', 'Out of Warranty'],
  ['OTHER_SERVICE', 'Other Service'],
  ['IRF', 'IRF'],
  ['AMC', 'AMC'],
];

const PAYMENT_MODES: Array<[PaymentMode, string]> = [
  ['CASH', 'Cash'],
  ['UPI', 'UPI'],
  ['BANK_TRANSFER', 'Bank Transfer'],
  ['CREDIT_CARD', 'Credit Card'],
  ['DEBIT_CARD', 'Debit Card'],
];

// GST % applied to typed-in lines and charges when the bill is a GST bill.
const SERVICE_GST_RATE = 18;

interface Line {
  key: string;
  skuId?: string;          // absent = typed-in line
  description: string;
  sub?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface PartResult {
  skuId: string;
  productName: string;
  variantName: string;
  partNumber?: string;
  sellingPrice: any;
  taxRate: any;
  stockQty: number;
  type: string;
}

interface Staff { id: string; name: string; role: string }

// A service visit being billed from My Service Jobs (?jobId=…). Its parts
// were already taken out of stock when the technician logged them, so they
// are listed here and billed through the job, not re-added as new lines.
interface JobPart { id: string; quantity: string; unitPrice: string; taxRate: string; sku: { product: { name: string } } }
interface Job {
  id: string;
  status: string;
  customerChargeAmount: string | null;
  customerChargeNotes: string | null;
  assignedTo: { id: string; name: string } | null;
  invoice: { id: string; billNo?: string | null } | null;
  parts: JobPart[];
  warranty: {
    customer: { id: string; name: string; phone: string; address: string | null; cardNo?: string | null };
    product: { name: string };
  };
}

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

export default function ServiceBillPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
      <ServiceBillInner />
    </Suspense>
  );
}

function ServiceBillInner() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get('jobId');
  const { user } = useAuthStore();
  const isStaff = user?.role === 'SERVICE_STAFF';
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [billNo, setBillNo] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [category, setCategory] = useState<ServiceCategory>('OUT_OF_WARRANTY');
  // "New service bill" from a customer's page arrives with ?customerId=…
  const [customerId, setCustomerId] = useState<string | null>(params.get('customerId'));
  const [tdsRaw, setTdsRaw] = useState('');
  const [tdsTreated, setTdsTreated] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [reinstallCharge, setReinstallCharge] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [gstApplied, setGstApplied] = useState(false);
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [received, setReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<any>(null);

  useEffect(() => {
    api.get<Staff[]>('/users/technicians')
      .then(({ data }) => setStaff(data))
      .catch(() => setStaff([]));
  }, []);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get<Job>(`/warranty/service-jobs/${jobId}`);
      setJob(data);
      setJobError(null);
    } catch (e: any) {
      setJobError(e.response?.data?.message || 'Could not load this service job');
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
    if (jobId) setCategory('WARRANTY');
  }, [jobId, loadJob]);

  const chargeLines = useMemo(() => {
    const out: Line[] = [];
    const r = parseFloat(reinstallCharge);
    const s = parseFloat(serviceCharge);
    if (r > 0) out.push({ key: 'reinstall', description: 'Re-installation Charges', quantity: 1, unitPrice: r, taxRate: SERVICE_GST_RATE });
    if (s > 0) out.push({ key: 'service', description: 'Service Charges', quantity: 1, unitPrice: s, taxRate: SERVICE_GST_RATE });
    return out;
  }, [reinstallCharge, serviceCharge]);

  const allLines = [...lines, ...chargeLines];
  // Job mode: the job's logged parts + its visit charge are billed as well.
  const jobPartsBase = (job?.parts || []).reduce((s, p) => s + parseFloat(p.unitPrice) * parseFloat(p.quantity), 0);
  const jobPartsTax = gstApplied
    ? (job?.parts || []).reduce((s, p) => s + (parseFloat(p.unitPrice) * parseFloat(p.quantity) * parseFloat(p.taxRate)) / 100, 0)
    : 0;
  const visitCharge = job ? parseFloat(job.customerChargeAmount || '0') : 0;
  const subtotal = allLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) + jobPartsBase + visitCharge;
  const tax = (gstApplied ? allLines.reduce((s, l) => s + (l.unitPrice * l.quantity * l.taxRate) / 100, 0) : 0) + jobPartsTax;
  const total = subtotal + tax;

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addPart = async (p: PartResult) => {
    if (job) {
      // Logged against the visit (takes it out of stock now, like the job sheet does).
      try {
        await api.post(`/warranty/service-jobs/${job.id}/parts`, { skuId: p.skuId, quantity: 1 });
        await loadJob();
      } catch (e: any) {
        setError(e.response?.data?.message || 'Could not add this part');
      }
      return;
    }
    setLines((ls) => [...ls, {
      key: newKey(),
      skuId: p.skuId,
      description: p.productName,
      sub: [p.variantName !== 'Standard' ? p.variantName : '', p.partNumber].filter(Boolean).join(' · '),
      quantity: 1,
      unitPrice: parseFloat(p.sellingPrice),
      taxRate: parseFloat(p.taxRate),
    }]);
  };

  const addTypedLine = () =>
    setLines((ls) => [...ls, { key: newKey(), description: '', quantity: 1, unitPrice: 0, taxRate: SERVICE_GST_RATE }]);

  const reset = () => {
    setBillNo(''); setCategory('OUT_OF_WARRANTY'); setCustomerId(null); setTdsRaw(''); setTdsTreated('');
    setLines([]); setReinstallCharge(''); setServiceCharge(''); setGstApplied(false); setReceived('');
    setNotes(''); setError(null); setCreated(null);
  };

  const removeJobPart = async (partId: string) => {
    if (!job) return;
    try {
      await api.delete(`/warranty/service-jobs/${job.id}/parts/${partId}`);
      await loadJob();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not remove this part');
    }
  };

  const closeVisit = async () => {
    if (!job) return;
    setClosing(true);
    try {
      await api.patch(`/warranty/service-jobs/${job.id}/close`, {});
      setClosed(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not close the visit');
    } finally {
      setClosing(false);
    }
  };

  const save = async () => {
    setError(null);
    if (job) return saveJobBill();
    if (!customerId) return setError('Select or add the customer first.');
    if (allLines.length === 0) return setError('Add a spare, a typed line or a charge.');
    const blank = lines.find((l) => !l.skuId && !l.description.trim());
    if (blank) return setError('Every typed line needs a description.');

    const paid = received.trim() === '' ? total : parseFloat(received);
    if (Number.isNaN(paid) || paid < 0) return setError('Enter a valid amount received.');

    setSaving(true);
    try {
      const { data } = await api.post('/billing/invoices', {
        billType: 'SERVICE',
        billNo: billNo.trim() || undefined,
        serviceCategory: category,
        technicianId: technicianId || undefined,
        tdsRaw: tdsRaw.trim() || undefined,
        tdsTreated: tdsTreated.trim() || undefined,
        customerId,
        gstApplied,
        notes: notes.trim() || undefined,
        items: allLines.map((l) => l.skuId
          ? { skuId: l.skuId, quantity: l.quantity, unitPrice: l.unitPrice }
          : { description: l.description.trim(), quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate }),
        payments: paid > 0 ? [{ mode: payMode, amount: Math.round(paid * 100) / 100 }] : [],
      });
      setCreated(data);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not save the service bill');
    } finally {
      setSaving(false);
    }
  };

  async function saveJobBill() {
    if (!job) return;
    if (allLines.length === 0 && job.parts.length === 0 && visitCharge <= 0) {
      return setError('Add a spare, a typed line or a charge.');
    }
    if (lines.find((l) => !l.skuId && !l.description.trim())) return setError('Every typed line needs a description.');
    const paid = received.trim() === '' ? total : parseFloat(received);
    if (Number.isNaN(paid) || paid < 0) return setError('Enter a valid amount received.');
    setSaving(true);
    try {
      const { data } = await api.patch(`/warranty/service-jobs/${job.id}/bill`, {
        billNo: billNo.trim() || undefined,
        serviceCategory: category,
        tdsRaw: tdsRaw.trim() || undefined,
        tdsTreated: tdsTreated.trim() || undefined,
        gstApplied,
        extraLines: allLines.map((l) => ({ description: l.description.trim(), quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
        payments: paid > 0 ? [{ mode: payMode, amount: Math.round(paid * 100) / 100 }] : [],
      });
      setCreated(data);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not save the service bill');
    } finally {
      setSaving(false);
    }
  }

  if (jobId && !job) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        {jobError || 'Loading service job…'}
        {jobError && (
          <button onClick={() => router.push('/service/my-jobs')} className="ml-2 text-red-700 underline">Back</button>
        )}
      </div>
    );
  }

  if (job?.invoice && !created) {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        This visit is already billed{job.invoice.billNo ? ` (Bill No. ${job.invoice.billNo})` : ''}.
        <button onClick={() => router.push(isStaff ? '/service/my-jobs' : '/service')} className="ml-2 text-red-700 underline">Back to jobs</button>
      </div>
    );
  }

  if (created) {
    return (
      <div className="h-full overflow-auto bg-gray-50 p-4">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <Wrench className="mx-auto h-10 w-10 text-red-700" />
          <h2 className="mt-3 text-lg font-bold">Service bill saved</h2>
          <p className="mt-1 text-3xl font-extrabold text-red-800">No. {created.billNo}</p>
          <p className="mt-1 text-sm text-gray-600">
            {created.customer?.name} · ₹{parseFloat(created.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => printReceipt(created)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            {job ? (
              <button
                onClick={() => router.push(isStaff ? '/service/my-jobs' : '/service')}
                className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                Back to jobs
              </button>
            ) : (
              <button onClick={reset} className="flex-1 rounded-lg bg-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300">
                New Service Bill
              </button>
            )}
          </div>
          {job && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
            closed ? (
              <p className="mt-4 rounded-lg bg-green-50 p-2 text-sm text-green-800">Visit closed — the next service visit has been scheduled.</p>
            ) : (
              <button
                onClick={closeVisit}
                disabled={closing}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                <CalendarCheck className="h-4 w-4" /> {closing ? 'Closing…' : 'Close visit & schedule next'}
              </button>
            )
          )}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <h1 className="font-bold text-gray-900">
          Service Bill
          {job && <span className="ml-2 text-sm font-normal text-gray-500">for {job.warranty.product.name} visit</span>}
        </h1>
        <RecentBills type="SERVICE" />
      </div>

      <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Bill details */}
          <section className="rounded-xl border bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bill No">
                <input
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="Auto — next number"
                  className="input"
                />
                <p className="mt-1 text-[11px] text-gray-500">Type the paper bill number when entering an existing bill.</p>
              </Field>
              <Field label="Technician">
                {job || isStaff ? (
                  <div className="input bg-gray-50">{job?.assignedTo?.name || user?.name || '—'}</div>
                ) : (
                  <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="input">
                    <option value="">—</option>
                    {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-gray-600">Service type</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      category === key ? 'border-red-700 bg-red-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Customer */}
          <section className="rounded-xl border bg-white p-4">
            {job ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm font-semibold text-red-900">
                  {job.warranty.customer.name}
                  {job.warranty.customer.cardNo && <span className="ml-1 font-mono text-xs text-blue-700">#{job.warranty.customer.cardNo}</span>}
                </p>
                <p className="text-xs text-red-700">{job.warranty.customer.phone}{job.warranty.customer.address ? ` · ${job.warranty.customer.address}` : ''}</p>
              </div>
            ) : (
              <>
                <span className="mb-1 block text-xs font-medium text-gray-600">Customer (search name, phone or card no)</span>
                <CustomerSearch selectedId={customerId} onSelect={setCustomerId} />
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="TDS — raw water">
                <input value={tdsRaw} onChange={(e) => setTdsRaw(e.target.value)} className="input" inputMode="numeric" />
              </Field>
              <Field label="TDS — treated water">
                <input value={tdsTreated} onChange={(e) => setTdsTreated(e.target.value)} className="input" inputMode="numeric" />
              </Field>
            </div>
          </section>

          {/* Spares */}
          <section className="rounded-xl border bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Spares &amp; work done</h2>
              <button onClick={addTypedLine} className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800">
                <Plus className="h-4 w-4" /> Typed line
              </button>
            </div>
            <PartSearch onPick={addPart} />

            {job && (job.parts.length > 0 || visitCharge > 0) && (
              <div className="mt-3 divide-y rounded-lg border bg-gray-50">
                {job.parts.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 p-2.5 text-sm">
                    <span className="flex-1">{p.sku.product.name} <span className="text-gray-500">× {parseFloat(p.quantity)}</span></span>
                    <span className="font-semibold">₹{fmt(parseFloat(p.unitPrice) * parseFloat(p.quantity))}</span>
                    <button onClick={() => removeJobPart(p.id)} className="text-gray-400 hover:text-red-600" aria-label="Remove part">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {visitCharge > 0 && (
                  <div className="flex items-center gap-2 p-2.5 text-sm">
                    <span className="flex-1">{job.customerChargeNotes || 'Visit charge'} <span className="text-xs text-gray-500">(from the visit)</span></span>
                    <span className="font-semibold">₹{fmt(visitCharge)}</span>
                    <span className="w-4" />
                  </div>
                )}
              </div>
            )}

            {lines.length === 0 ? (
              job ? null : <p className="mt-3 text-center text-sm text-gray-400">No spares added yet</p>
            ) : (
              <div className="mt-3 divide-y rounded-lg border">
                {lines.map((l, i) => (
                  <div key={l.key} className="flex flex-wrap items-start gap-2 p-2.5">
                    <span className="w-5 pt-2 text-xs text-gray-400">{i + 1}</span>
                    <div className="min-w-[160px] flex-1">
                      {l.skuId ? (
                        <>
                          <div className="pt-1.5 text-sm font-medium">{l.description}</div>
                          {l.sub && <div className="text-xs text-gray-500">{l.sub}</div>}
                        </>
                      ) : (
                        <input
                          value={l.description}
                          onChange={(e) => updateLine(l.key, { description: e.target.value })}
                          placeholder="e.g. IRF media changed"
                          className="input"
                        />
                      )}
                    </div>
                    <label className="w-16">
                      <span className="block text-[10px] text-gray-500">Qty</span>
                      <input
                        type="number" min={1} value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                        className="input text-center"
                      />
                    </label>
                    <label className="w-24">
                      <span className="block text-[10px] text-gray-500">Price ₹</span>
                      <input
                        type="number" min={0} value={l.unitPrice}
                        onChange={(e) => updateLine(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                        className="input text-right"
                      />
                    </label>
                    <div className="w-24 pt-5 text-right text-sm font-semibold">₹{fmt(l.unitPrice * l.quantity)}</div>
                    <button
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="pt-5 text-gray-400 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Re-installation charges ₹">
                <input type="number" min={0} value={reinstallCharge} onChange={(e) => setReinstallCharge(e.target.value)} className="input" />
              </Field>
              <Field label="Service charges ₹">
                <input type="number" min={0} value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} className="input" />
              </Field>
            </div>
            <Field label="Notes" className="mt-3">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
            </Field>
          </section>
        </div>

        {/* Totals + payment */}
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 text-sm lg:sticky lg:top-16">
            <label className="mb-3 flex items-center gap-2">
              <input type="checkbox" checked={gstApplied} onChange={(e) => setGstApplied(e.target.checked)} />
              <span>GST bill</span>
            </label>
            <Row label="Sub total" value={`₹${fmt(subtotal)}`} />
            <Row label="GST" value={gstApplied ? `₹${fmt(tax)}` : 'Not applied'} />
            <div className="mt-2 flex justify-between border-t pt-2 text-lg font-extrabold text-red-800">
              <span>Grand Total</span><span>₹{fmt(total)}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Field label="Paid by">
                <select value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode)} className="input">
                  {PAYMENT_MODES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Amount received ₹">
                <input
                  type="number" min={0} value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder={fmt(total)}
                  className="input"
                />
              </Field>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Leave blank if paid in full. Enter 0 if not paid yet.</p>

            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">{error}</div>}

            <button
              onClick={save}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-red-700 py-3 font-bold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : `Save Service Bill — ₹${fmt(total)}`}
            </button>
          </section>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.45rem 0.6rem;
          font-size: 0.875rem;
          background: #fff;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-gray-700">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function PartSearch({ onPick }: { onPick: (p: PartResult) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<PartResult[]>(`/billing/lookup/search?q=${encodeURIComponent(term)}`);
        if (id === reqId.current) setResults(data.filter((r) => r.type !== 'serial'));
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search spare by name or code…"
        className="input pl-8"
        style={{ paddingLeft: '2rem' }}
      />
      {(results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {loading && <div className="p-2 text-xs text-gray-400">Searching…</div>}
          {results.map((r) => (
            <button
              key={r.skuId}
              onClick={() => { onPick(r); setQ(''); setResults([]); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span>
                <span className="font-medium">{r.productName}</span>
                {r.variantName !== 'Standard' && <span className="text-gray-500"> · {r.variantName}</span>}
                {r.partNumber && <span className="ml-1 font-mono text-xs text-red-700">{r.partNumber}</span>}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                ₹{parseFloat(r.sellingPrice).toLocaleString('en-IN')}
                {r.type === 'bulk' && ` · ${r.stockQty} in stock`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
