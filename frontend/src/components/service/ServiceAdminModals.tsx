'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { localDateString } from '@/lib/local-date';

// Admin editing for the Service screen: AMC terms, individual visits, extra
// visits and technicians' service requests.

export const FREQUENCIES: Array<[string, string]> = [
  ['MONTHLY', 'Every month'],
  ['QUARTERLY', 'Every 3 months'],
  ['HALF_YEARLY', 'Every 6 months'],
  ['YEARLY', 'Every year'],
  ['CUSTOM', 'Custom…'],
];

export function frequencyLabel(freq: string | null | undefined, months?: number | null) {
  if (!freq) return '—';
  if (freq === 'CUSTOM') return `Every ${months ?? '?'} month${months === 1 ? '' : 's'}`;
  return FREQUENCIES.find(([k]) => k === freq)?.[1] ?? freq;
}

export const SERVICE_TYPES: Array<[string, string]> = [
  ['WARRANTY', 'Warranty'],
  ['OUT_OF_WARRANTY', 'Out of Warranty'],
  ['OTHER_SERVICE', 'Other Service'],
  ['IRF', 'IRF'],
  ['AMC', 'AMC'],
];

// Frequency select + "every N months" box when Custom is chosen.
export function FrequencyPicker({ value, months, onChange }: {
  value: string;
  months: string;
  onChange: (value: string, months: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select value={value} onChange={(e) => onChange(e.target.value, months)} className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm">
        {FREQUENCIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {value === 'CUSTOM' && (
        <label className="flex items-center gap-1 text-sm text-gray-600">
          every
          <input type="number" min={1} max={60} value={months} onChange={(e) => onChange(value, e.target.value)} className="w-16 rounded-lg border px-2 py-2 text-sm" />
          months
        </label>
      )}
    </div>
  );
}

function Shell({ title, subtitle, onClose, children, footer }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b bg-white p-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
        <div className="sticky bottom-0 flex gap-3 border-t bg-white p-5">{footer}</div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
    {children}
  </label>
);
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm';
const errMsg = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || fallback;
};
const dateIn = (d?: string | null) => (d ? localDateString(new Date(d)) : '');

export interface AmcForEdit {
  id: string;
  status: string;
  startDate: string;
  warrantyPeriodMonths: number | null;
  serviceFrequency: string | null;
  frequencyMonths?: number | null;
  amcFrom?: string | null;
  amcTo?: string | null;
  notes?: string | null;
  customer: { name: string };
  product: { id: string; name: string };
}

// Full AMC edit: product, start date, period, frequency (incl. custom),
// AMC period, notes, and optionally move the next visit to match.
export function AmcEditModal({ amc, onClose, onSaved }: { amc: AmcForEdit; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [productId, setProductId] = useState(amc.product.id);
  const [startDate, setStartDate] = useState(dateIn(amc.startDate));
  const [months, setMonths] = useState(String(amc.warrantyPeriodMonths ?? 12));
  const [freq, setFreq] = useState(amc.serviceFrequency ?? 'QUARTERLY');
  const [freqMonths, setFreqMonths] = useState(String(amc.frequencyMonths ?? 3));
  const [amcFrom, setAmcFrom] = useState(dateIn(amc.amcFrom));
  const [amcTo, setAmcTo] = useState(dateIn(amc.amcTo));
  const [notes, setNotes] = useState(amc.notes ?? '');
  const [recalc, setRecalc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/inventory/products', { params: { limit: 500 } })
      .then(({ data }) => {
        const list = (Array.isArray(data) ? data : data.data || []) as Array<{ id: string; name: string; requiresService?: boolean }>;
        setProducts(list.filter((p) => p.requiresService || p.id === amc.product.id));
      })
      .catch(() => setProducts([amc.product]));
  }, [amc.product]);

  const scheduleChanged = startDate !== dateIn(amc.startDate) || freq !== amc.serviceFrequency ||
    (freq === 'CUSTOM' && +freqMonths !== (amc.frequencyMonths ?? 0));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/warranty/${amc.id}`, {
        productId,
        startDate,
        warrantyPeriodMonths: +months,
        serviceFrequency: freq,
        ...(freq === 'CUSTOM' ? { frequencyMonths: +freqMonths } : {}),
        amcFrom: amcFrom || null,
        amcTo: amcTo || null,
        notes,
        recalcNextDue: recalc,
      });
      onSaved();
    } catch (e) {
      setError(errMsg(e, 'Could not save the AMC'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Edit AMC"
      subtitle={`${amc.customer.name}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Field label="Product">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls + ' bg-white'}>
          {(products.length ? products : [amc.product]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start / install date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Warranty period (months)"><input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Service frequency">
        <FrequencyPicker value={freq} months={freqMonths} onChange={(v, m) => { setFreq(v); setFreqMonths(m); }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="AMC from"><input type="date" value={amcFrom} onChange={(e) => setAmcFrom(e.target.value)} className={inputCls} /></Field>
        <Field label="AMC to"><input type="date" value={amcTo} onChange={(e) => setAmcTo(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="e.g. Hard water — check softener salt every visit" /></Field>
      <label className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${scheduleChanged ? 'border-amber-300 bg-amber-50' : ''}`}>
        <input type="checkbox" checked={recalc} onChange={(e) => setRecalc(e.target.checked)} className="mt-0.5" />
        <span>Move the next scheduled visit to match the new schedule<span className="block text-xs text-gray-500">Otherwise the next visit keeps its date; the new frequency applies from the following visit.</span></span>
      </label>
    </Shell>
  );
}

export interface VisitForEdit {
  id: string;
  status: string;
  dueDate: string;
  visitDate: string | null;
  isExtra?: boolean;
  serviceCategory?: string | null;
  customerFeedback: string | null;
  customerChargeAmount: string | null;
  customerChargeNotes: string | null;
  staffExpenseAmount: string | null;
  staffExpenseNotes: string | null;
  assignedTo: { id: string; name: string } | null;
  invoiceId: string | null;
}

// Admin correction of one visit — any field, reopen a closed visit, or delete
// one created by mistake (unbilled only; its spares go back to stock).
export function VisitEditModal({ visit, staff, title, onClose, onSaved }: {
  visit: VisitForEdit; staff: Array<{ id: string; name: string }>; title: string; onClose: () => void; onSaved: () => void;
}) {
  const closed = visit.status === 'COMPLETED' || visit.status === 'CANCELLED';
  const [dueDate, setDueDate] = useState(dateIn(visit.dueDate));
  const [visitDate, setVisitDate] = useState(dateIn(visit.visitDate));
  const [tech, setTech] = useState(visit.assignedTo?.id ?? '');
  const [type, setType] = useState(visit.serviceCategory ?? '');
  const [feedback, setFeedback] = useState(visit.customerFeedback ?? '');
  const [charge, setCharge] = useState(visit.customerChargeAmount ?? '');
  const [chargeNotes, setChargeNotes] = useState(visit.customerChargeNotes ?? '');
  const [expense, setExpense] = useState(visit.staffExpenseAmount ?? '');
  const [expenseNotes, setExpenseNotes] = useState(visit.staffExpenseNotes ?? '');
  const [reopen, setReopen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/warranty/service-jobs/${visit.id}/admin`, {
        dueDate,
        visitDate: visitDate || null,
        assignedToId: tech || null,
        serviceCategory: type || null,
        customerFeedback: feedback || null,
        customerChargeAmount: charge === '' ? null : +charge,
        customerChargeNotes: chargeNotes || null,
        staffExpenseAmount: expense === '' ? null : +expense,
        staffExpenseNotes: expenseNotes || null,
        ...(reopen ? { reopen: true } : {}),
      });
      onSaved();
    } catch (e) {
      setError(errMsg(e, 'Could not save the visit'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/warranty/service-jobs/${visit.id}`);
      onSaved();
    } catch (e) {
      setError(errMsg(e, 'Could not delete the visit'));
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Edit visit"
      subtitle={title}
      onClose={onClose}
      footer={confirmDelete ? <>
        <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border py-2 text-sm text-gray-600">Keep it</button>
        <button onClick={remove} disabled={saving} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Deleting…' : 'Yes, delete visit'}</button>
      </> : <>
        {!visit.invoiceId && (
          <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
        )}
        <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {confirmDelete && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Delete this visit? Spares logged on it go back to stock. This can&apos;t be undone.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Visited on"><input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Technician">
          <select value={tech} onChange={(e) => setTech(e.target.value)} className={inputCls + ' bg-white'}>
            <option value="">Not assigned</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Service type">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls + ' bg-white'}>
            <option value="">—</option>
            {SERVICE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Customer feedback"><textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Charge to customer ₹"><input type="number" min={0} value={charge} onChange={(e) => setCharge(e.target.value)} className={inputCls} disabled={!!visit.invoiceId} /></Field>
        <Field label="Charge notes"><input value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} className={inputCls} /></Field>
        <Field label="Technician expense ₹"><input type="number" min={0} value={expense} onChange={(e) => setExpense(e.target.value)} className={inputCls} /></Field>
        <Field label="Expense notes"><input value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} className={inputCls} /></Field>
      </div>
      {visit.invoiceId && <p className="text-xs text-gray-500">This visit is billed — the charge is on the bill and can&apos;t be changed here.</p>}
      {closed && (
        <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          <input type="checkbox" checked={reopen} onChange={(e) => setReopen(e.target.checked)} />
          Reopen this {visit.status === 'CANCELLED' ? 'cancelled' : 'completed'} visit
        </label>
      )}
    </Shell>
  );
}

// Extra (or regular) visit on any date for one AMC, optionally assigned.
export function AddVisitModal({ amc, staff, onClose, onSaved }: {
  amc: { id: string; customer: { name: string }; product: { name: string } };
  staff: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dueDate, setDueDate] = useState(localDateString(new Date(Date.now() + 86400000)));
  const [tech, setTech] = useState('');
  const [type, setType] = useState('');
  const [regular, setRegular] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/warranty/service-jobs', {
        warrantyId: amc.id, dueDate, isExtra: !regular,
        ...(tech ? { assignedToId: tech } : {}),
        ...(type ? { serviceCategory: type } : {}),
      });
      onSaved();
    } catch (e) {
      setError(errMsg(e, 'Could not add the visit'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Add visit"
      subtitle={`${amc.product.name} — ${amc.customer.name}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving || !dueDate} className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{saving ? 'Adding…' : 'Add visit'}</button>
      </>}
    >
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
      <Field label="Technician">
        <select value={tech} onChange={(e) => setTech(e.target.value)} className={inputCls + ' bg-white'}>
          <option value="">Assign later</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Service type (optional)">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls + ' bg-white'}>
          <option value="">—</option>
          {SERVICE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <label className="flex items-start gap-2 rounded-lg border p-2 text-sm">
        <input type="checkbox" checked={regular} onChange={(e) => setRegular(e.target.checked)} className="mt-0.5" />
        <span>Part of the regular schedule<span className="block text-xs text-gray-500">Closing a regular visit schedules the next one. Leave unticked for an extra / call-out visit.</span></span>
      </label>
    </Shell>
  );
}

export interface RequestForReview {
  id: string;
  dueDate: string;
  requestNote: string | null;
  requestedBy: { id: string; name: string } | null;
  warranty: { customer: { name: string }; product: { name: string } };
}

// Approve a technician's service request: confirm the date and technician.
export function ApproveRequestModal({ request, staff, onClose, onSaved }: {
  request: RequestForReview; staff: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void;
}) {
  const [dueDate, setDueDate] = useState(dateIn(request.dueDate));
  const [tech, setTech] = useState(request.requestedBy?.id ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/warranty/service-requests/${request.id}/approve`, { dueDate, assignedToId: tech || undefined, note: note || undefined });
      onSaved();
    } catch (e) {
      setError(errMsg(e, 'Could not approve'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Approve service request"
      subtitle={`${request.warranty.product.name} — ${request.warranty.customer.name}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{saving ? 'Approving…' : 'Approve'}</button>
      </>}
    >
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {request.requestNote && <p className="rounded-lg bg-gray-50 p-2 text-sm text-gray-700">&ldquo;{request.requestNote}&rdquo; — {request.requestedBy?.name}</p>}
      <Field label="Visit date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
      <Field label="Technician">
        <select value={tech} onChange={(e) => setTech(e.target.value)} className={inputCls + ' bg-white'}>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === request.requestedBy?.id ? ' (asked)' : ''}</option>)}
        </select>
      </Field>
      <Field label="Note to technician (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
    </Shell>
  );
}
