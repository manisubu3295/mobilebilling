'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BellRing, CalendarClock, Check, MapPin, MessageCircle, Phone, Search, UserCog } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { localDateString } from '@/lib/local-date';

interface DueJob {
  id: string;
  dueDate: string;
  overdue: boolean;
  status: string;
  remindedAt: string | null;
  remindedBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  warranty: {
    customer: { id: string; name: string; phone: string; address: string | null; cardNo?: string | null };
    product: { name: string };
  };
}

type Bucket = 'OVERDUE' | 'TODAY' | 'WEEK' | 'LATER';
const BUCKETS: Array<[Bucket, string]> = [['OVERDUE', 'Overdue'], ['TODAY', 'Today'], ['WEEK', 'This week'], ['LATER', 'Later']];

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysFromToday = (iso: string) => Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / DAY);

function bucketOf(job: DueJob): Bucket {
  const d = daysFromToday(job.dueDate);
  if (d < 0) return 'OVERDUE';
  if (d === 0) return 'TODAY';
  if (d <= 7) return 'WEEK';
  return 'LATER';
}

function dueInWords(iso: string) {
  const d = daysFromToday(iso);
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d} days`;
}

const waHref = (phone: string, text: string) =>
  `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}?text=${encodeURIComponent(text)}`;

// Who to call about an upcoming/overdue service visit, with one-tap Call /
// WhatsApp / Mark reminded, and (for admins) assign + reschedule in place.
export default function NextServicePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'STORE_MANAGER';
  const [items, setItems] = useState<DueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number | null>(null);
  const [bucket, setBucket] = useState<Bucket>('OVERDUE');
  const [query, setQuery] = useState('');
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number | null) => {
    setLoading(true);
    try {
      const { data } = await api.get('/warranty/nearing-due', { params: d != null ? { days: d } : {} });
      setItems(data.items);
      setDays((cur) => cur ?? data.daysAhead);
      // Open on the first bucket that has something in it.
      const first = BUCKETS.find(([b]) => data.items.some((j: DueJob) => bucketOf(j) === b));
      if (first && d == null) setBucket(first[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(null); }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/users/technicians').then(({ data }) => setStaff(data)).catch(() => setStaff([]));
  }, [isAdmin]);

  const q = query.trim().toLowerCase();
  const matching = useMemo(() => items.filter((j) =>
    !q ||
    j.warranty.customer.name.toLowerCase().includes(q) ||
    j.warranty.customer.phone.includes(q) ||
    (j.warranty.customer.cardNo || '').toLowerCase() === q ||
    j.warranty.product.name.toLowerCase().includes(q)), [items, q]);
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { OVERDUE: 0, TODAY: 0, WEEK: 0, LATER: 0 };
    for (const j of matching) c[bucketOf(j)]++;
    return c;
  }, [matching]);
  const shown = matching.filter((j) => bucketOf(j) === bucket);

  const replace = (updated: DueJob) =>
    setItems((list) => list.map((j) => (j.id === updated.id ? { ...j, ...updated, overdue: j.overdue } : j)));

  const act = async (fn: () => Promise<{ data: DueJob }>) => {
    setError(null);
    try {
      const { data } = await fn();
      replace(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not update this visit');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-red-700" /> Next Service
          </h1>
          <select
            value={days ?? ''}
            onChange={(e) => { const d = +e.target.value; setDays(d); load(d); }}
            className="border rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Next {d} days</option>)}
            {days !== null && ![7, 14, 30, 60, 90].includes(days) && <option value={days}>Next {days} days</option>}
          </select>
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
        <div className="flex gap-1.5 overflow-x-auto">
          {BUCKETS.map(([b, label]) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                bucket === b
                  ? b === 'OVERDUE' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label} <span className="ml-0.5 opacity-80">{counts[b]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-3">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <CalendarClock className="h-10 w-10 opacity-40" />
            <p>Nothing {BUCKETS.find(([b]) => b === bucket)?.[1].toLowerCase()}{q ? ' matching your search' : ''}</p>
          </div>
        ) : (
          shown.map((j) => (
            <DueCard
              key={j.id}
              job={j}
              isAdmin={isAdmin}
              staff={staff}
              onReminded={(reminded) => act(() => api.patch(`/warranty/service-jobs/${j.id}/reminded`, { reminded }))}
              onAssign={(assignedToId) => act(() => api.patch(`/warranty/service-jobs/${j.id}/assign`, { assignedToId }))}
              onReschedule={(dueDate) => act(async () => {
                const res = await api.patch(`/warranty/service-jobs/${j.id}/reschedule`, { dueDate });
                return res;
              })}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DueCard({ job, isAdmin, staff, onReminded, onAssign, onReschedule }: {
  job: DueJob;
  isAdmin: boolean;
  staff: { id: string; name: string }[];
  onReminded: (reminded: boolean) => void;
  onAssign: (id: string) => void;
  onReschedule: (date: string) => void;
}) {
  const c = job.warranty.customer;
  const overdue = daysFromToday(job.dueDate) < 0;
  const dueText = new Date(job.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  const message =
    `Hello ${c.name}, this is a reminder from our water purifier service team: your ${job.warranty.product.name} ` +
    `service is ${overdue ? 'overdue (was due' : 'due on'} ${dueText}${overdue ? ')' : ''}. Please reply with a convenient time for the visit. Thank you.`;

  return (
    <div className={`bg-white rounded-xl border p-4 ${overdue ? 'border-red-200' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            {c.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{c.cardNo}</span>}
            <Link href={`/customers/${c.id}`} className="hover:underline">{c.name}</Link>
          </p>
          <p className="text-sm text-gray-600">{job.warranty.product.name}</p>
          {c.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 hover:underline"
            >
              <MapPin className="h-3 w-3 shrink-0" /> {c.address}
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold ${overdue ? 'text-red-600' : 'text-gray-800'}`}>{dueInWords(job.dueDate)}</p>
          <p className="text-xs text-gray-400">{dueText}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {job.assignedTo ? `Technician: ${job.assignedTo.name}` : 'No technician assigned'}
        {job.remindedAt && (
          <span className="ml-2 text-green-700">
            · Reminded {new Date(job.remindedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {job.remindedBy ? ` by ${job.remindedBy.name}` : ''}
          </span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
          <Phone className="h-4 w-4" /> Call
        </a>
        <a
          href={waHref(c.phone, message)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button
          onClick={() => onReminded(!job.remindedAt)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
            job.remindedAt ? 'bg-green-600 text-white hover:bg-green-700' : 'border text-gray-700 hover:bg-gray-50'
          }`}
        >
          {job.remindedAt ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          {job.remindedAt ? 'Reminded' : 'Mark reminded'}
        </button>
        {isAdmin && (
          <>
            <label className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm text-gray-700">
              <UserCog className="h-4 w-4 text-gray-400" />
              <select
                value={job.assignedTo?.id || ''}
                onChange={(e) => e.target.value && onAssign(e.target.value)}
                className="bg-transparent py-1 text-sm focus:outline-none"
              >
                <option value="">Assign…</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm text-gray-700">
              <CalendarClock className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={localDateString(new Date(job.dueDate))}
                onChange={(e) => e.target.value && onReschedule(e.target.value)}
                className="bg-transparent py-1 text-sm focus:outline-none"
                title="Reschedule"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
