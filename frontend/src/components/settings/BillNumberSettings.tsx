'use client';

import React, { useEffect, useState } from 'react';
import { Hash, Save, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';

type SeqKey = 'GST_SALES' | 'SALES' | 'SERVICE' | 'CARD';
interface Sequence { key: SeqKey; fy: string; next: number }

const LABELS: Record<SeqKey, { title: string; hint: (fy: string) => string }> = {
  GST_SALES: { title: 'GST tax invoice', hint: (fy) => `Restarts every 1 April · FY ${fy}` },
  SALES:     { title: 'Sales bill (no GST)', hint: () => 'Runs continuously' },
  SERVICE:   { title: 'Service bill', hint: () => 'Runs continuously' },
  CARD:      { title: 'Warranty card / Customer ID', hint: () => 'Suggested for new cards' },
};

// "Next number" for each printed series — lets the owner carry on from the
// last number in their paper bill books instead of restarting at 001.
export function BillNumberSettings({ canEdit, showService }: { canEdit: boolean; showService: boolean }) {
  const [rows, setRows] = useState<Sequence[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<Sequence[]>('/settings/sequences').then(({ data }) => {
      setRows(data);
      setDraft(Object.fromEntries(data.map((r) => [r.key, String(r.next)])));
    }).catch(() => setRows([]));
  }, []);

  const visible = rows.filter((r) => showService || (r.key !== 'SERVICE' && r.key !== 'CARD'));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, number> = {};
      for (const r of visible) {
        const n = parseInt(draft[r.key], 10);
        if (!Number.isInteger(n) || n < 1) throw new Error(`${LABELS[r.key].title}: enter a number of 1 or more`);
        if (n !== r.next) body[r.key] = n;
      }
      const { data } = await api.patch<Sequence[]>('/settings/sequences', body);
      setRows(data);
      setMessage({ ok: true, text: 'Saved' });
    } catch (e: any) {
      setMessage({ ok: false, text: e?.response?.data?.message || e.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Hash className="h-5 w-5 text-red-700" />
        <h2 className="font-semibold text-gray-900">Bill Numbers</h2>
      </div>
      <p className="text-xs text-gray-500">
        The next number each new bill will get. Set it to continue from your paper bill book.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visible.map((r) => (
          <label key={r.key} className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{LABELS[r.key].title}</span>
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              value={draft[r.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
            />
            <span className="text-xs text-gray-400">{LABELS[r.key].hint(r.fy)}</span>
          </label>
        ))}
      </div>
      {message && <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
      {canEdit && (
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Bill Numbers'}
        </button>
      )}
    </div>
  );
}

// Terms block printed at the bottom of the warranty card (the client's card
// has these in Tamil — working hours, free-service count, filter schedule…).
export function WarrantyCardSettings({ initial, canEdit }: { initial: string; canEdit: boolean }) {
  const [terms, setTerms] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setTerms(initial), [initial]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/settings/store', { warrantyCardTerms: terms });
      setMessage({ ok: true, text: 'Saved' });
    } catch (e: any) {
      setMessage({ ok: false, text: e?.response?.data?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-red-700" />
        <h2 className="font-semibold text-gray-900">Warranty Card</h2>
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Customer terms printed on the card</span>
        <textarea
          rows={6}
          disabled={!canEdit}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder={'வேலை நேரம் : காலை 9.00 மணி முதல் மாலை 6.00 மணி வரை மட்டுமே.\nவாரண்டி காலம் 1 வருடம்…'}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
        />
        <span className="text-xs text-gray-400">One point per line. Tamil or English.</span>
      </label>
      {message && <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
      {canEdit && (
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Terms'}
        </button>
      )}
    </div>
  );
}
