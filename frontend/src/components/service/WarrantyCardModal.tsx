'use client';

import React, { useEffect, useState } from 'react';
import { Printer, Save, X } from 'lucide-react';
import api from '@/lib/api';
import { openPrintPreview } from '@/store/print.store';
import { buildWarrantyCardHtml, warrantyEndDate, WarrantyCardData } from '@/lib/print-warranty-card';

type Form = Record<
  | 'cardNo' | 'address' | 'city' | 'landmark' | 'cardDate'
  | 'tds' | 'hardness' | 'iron' | 'otherImpurities'
  | 'brand' | 'model' | 'pump' | 'membrane' | 'power' | 'vessel' | 'valve' | 'media'
  | 'soldBy' | 'installedBy' | 'amcFrom' | 'amcTo',
  string
>;

const dateInput = (v?: string | null) => (v ? v.slice(0, 10) : '');

function toForm(c: WarrantyCardData & { customer: any }): Form {
  return {
    cardNo: c.customer.cardNo || '',
    address: c.customer.address || '',
    city: c.customer.city || '',
    landmark: c.customer.landmark || '',
    cardDate: dateInput(c.cardDate || c.startDate),
    tds: c.tds || '', hardness: c.hardness || '', iron: c.iron || '', otherImpurities: c.otherImpurities || '',
    brand: c.brand || c.product.brand || '',
    model: c.model || '',
    pump: c.pump || '', membrane: c.membrane || '', power: c.power || '',
    vessel: c.vessel || '', valve: c.valve || '', media: c.media || '',
    soldBy: c.soldBy || c.store.name || '',
    installedBy: c.installedBy || '',
    amcFrom: dateInput(c.amcFrom), amcTo: dateInput(c.amcTo),
  };
}

// Fill in and print the customer's warranty card / service record.
export function WarrantyCardModal({ warrantyId, onClose, onSaved }: {
  warrantyId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [card, setCard] = useState<WarrantyCardData | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/warranty/${warrantyId}/card`);
        const f = toForm(data);
        if (!f.cardNo) {
          const { data: next } = await api.get('/customers/next-card-no').catch(() => ({ data: { cardNo: '' } }));
          f.cardNo = next.cardNo || '';
        }
        setCard(data);
        setForm(f);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Could not load the warranty card');
      }
    })();
  }, [warrantyId]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const save = async (print: boolean) => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch(`/warranty/${warrantyId}/card`, {
        ...form,
        cardDate: form.cardDate || null,
        amcFrom: form.amcFrom || null,
        amcTo: form.amcTo || null,
      });
      setCard(data);
      onSaved?.();
      if (print) {
        openPrintPreview(buildWarrantyCardHtml(data), `Warranty Card ${data.customer.cardNo || data.customer.name}`);
        onClose();
      }
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const input = (k: keyof Form, label: string, type = 'text') => (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</span>
      <input
        type={type}
        value={form?.[k] ?? ''}
        onChange={set(k)}
        className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </label>
  );

  const warrantyTo = card ? warrantyEndDate(card.startDate, card.warrantyPeriodMonths) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-bold">Warranty Card</h2>
            {card && <p className="text-xs text-gray-500">{card.customer.name} · {card.customer.phone} · {card.product.name}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>

        {!form ? (
          <div className="p-8 text-center text-sm text-gray-400">{error || 'Loading…'}</div>
        ) : (
          <div className="space-y-4 p-4">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Customer details</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {input('cardNo', 'Customer ID / Card No')}
                {input('cardDate', 'Date', 'date')}
                <div className="col-span-2 sm:col-span-1">{input('city', 'City')}</div>
                <div className="col-span-2">{input('address', 'Address')}</div>
                {input('landmark', 'Land Mark')}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Water test</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {input('tds', 'TDS')}
                {input('hardness', 'Hardness')}
                {input('iron', 'Iron')}
                {input('otherImpurities', 'Other impurities')}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Product details</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {input('brand', 'Brand')}
                {input('model', 'Model')}
                {input('pump', 'Pump')}
                {input('membrane', 'Membrane')}
                {input('power', 'Power')}
                {input('vessel', 'Vessel')}
                {input('valve', 'Valve')}
                {input('media', 'Media')}
                {input('soldBy', 'Sold by')}
                {input('installedBy', 'Installed by')}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">RO units: pump, membrane, power. Softener / IRF: vessel, valve, media.</p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">Warranty</h3>
                <p className="text-sm">
                  {card && new Date(card.startDate).toLocaleDateString('en-GB')} → {warrantyTo ? new Date(warrantyTo).toLocaleDateString('en-GB') : '—'}
                </p>
                <p className="text-[11px] text-gray-500">From the AMC start date and period (change with Edit).</p>
              </div>
              <div className="rounded-lg border p-3">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">AMC</h3>
                <div className="grid grid-cols-2 gap-2">
                  {input('amcFrom', 'From', 'date')}
                  {input('amcTo', 'To', 'date')}
                </div>
              </div>
            </section>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3 border-t pt-4">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> {saving ? 'Saving…' : 'Save & Print'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
