'use client';

import React, { useEffect, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import api from '@/lib/api';
import { CustomerSearch } from '@/components/billing/CustomerSearch';
import { localDateString } from '@/lib/local-date';

interface EligibleAmc {
  id: string;
  product: { name: string };
  serviceFrequency: string | null;
  nextServiceDueAt: string | null;
  serviceJobs: Array<{ id: string; dueDate: string; status: string; assignedTo: { name: string } | null }>;
}

const dateText = (d: string) => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });

// Technician asks for a visit: customer → one of their active AMCs → date →
// note. It goes to the admin to approve (then it shows up as an assigned job).
export function ScheduleServiceModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [amcs, setAmcs] = useState<EligibleAmc[] | null>(null);
  const [warrantyId, setWarrantyId] = useState('');
  const [date, setDate] = useState(localDateString(new Date(Date.now() + 86400000)));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAmcs(null);
    setWarrantyId('');
    if (!customerId) return;
    api.get<EligibleAmc[]>(`/warranty/customer/${customerId}/active`)
      .then(({ data }) => {
        setAmcs(data);
        if (data.length === 1) setWarrantyId(data[0].id);
      })
      .catch(() => setAmcs([]));
  }, [customerId]);

  const chosen = amcs?.find((a) => a.id === warrantyId);
  const pendingRequest = chosen?.serviceJobs.find((j) => j.status === 'REQUESTED');

  const submit = async () => {
    setError('');
    if (!warrantyId) return setError('Pick the service (AMC) for this customer.');
    setSaving(true);
    try {
      await api.post('/warranty/service-requests', { warrantyId, preferredDate: date, note: note.trim() || undefined });
      onSent();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not send the request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarPlus className="h-5 w-5 text-red-700" /> Schedule a service</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">1. Customer (name, phone or card no)</span>
            <CustomerSearch selectedId={customerId} onSelect={setCustomerId} />
          </div>

          {customerId && (
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-600">2. Service</span>
              {amcs === null ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : amcs.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                  This customer has no active AMC / warranty. For a paid visit, raise a Service Bill instead.
                </p>
              ) : (
                <select value={warrantyId} onChange={(e) => setWarrantyId(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {amcs.map((a) => {
                    const open = a.serviceJobs.find((j) => j.status !== 'REQUESTED');
                    return (
                      <option key={a.id} value={a.id}>
                        {a.product.name}{open ? ` — next visit ${dateText(open.dueDate)}` : ''}
                      </option>
                    );
                  })}
                </select>
              )}
              {chosen && (
                <p className="mt-1 text-xs text-gray-500">
                  {chosen.serviceJobs.filter((j) => j.status !== 'REQUESTED').map((j) =>
                    `Scheduled visit ${dateText(j.dueDate)}${j.assignedTo ? ` (${j.assignedTo.name})` : ''}`).join(' · ') || 'No visit scheduled yet'}
                </p>
              )}
              {pendingRequest && (
                <p className="mt-1 text-xs text-amber-700">A request for this service is already waiting for approval ({dateText(pendingRequest.dueDate)}).</p>
              )}
            </div>
          )}

          {warrantyId && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">3. Preferred date</span>
                <input type="date" value={date} min={localDateString()} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Note for admin (optional)</span>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer called — low water flow" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </>
          )}

          <p className="text-xs text-gray-500">The admin approves the request; it then appears in your jobs.</p>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={submit} disabled={saving || !warrantyId} className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              {saving ? 'Sending…' : 'Send for approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
