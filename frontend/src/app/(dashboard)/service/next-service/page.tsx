'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, AlertTriangle, Clock } from 'lucide-react';
import api from '@/lib/api';

interface DueJob {
  id: string;
  dueDate: string;
  overdue: boolean;
  status: string;
  assignedTo: { id: string; name: string } | null;
  warranty: {
    customer: { name: string; phone: string };
    product: { name: string };
  };
}

// Read-only lookahead of upcoming/overdue service visits. Defaults to the
// store's configured window (Settings → Service Settings) — the days input
// here only changes what this one view shows, not the stored default.
export default function NextServicePage() {
  const [items, setItems] = useState<DueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number | null>(null);
  const [defaultDays, setDefaultDays] = useState<number | null>(null);

  const load = useCallback(async (d: number | null) => {
    setLoading(true);
    try {
      const { data } = await api.get('/warranty/nearing-due', { params: d != null ? { days: d } : {} });
      setItems(data.items);
      if (defaultDays === null) setDefaultDays(data.daysAhead);
      if (days === null) setDays(data.daysAhead);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(null); }, [load]);

  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-red-700" /> Next Service</h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only lookahead — reschedule or reassign from Service Jobs.</p>
        </div>
        <select
          value={days ?? ''}
          onChange={(e) => { const d = +e.target.value; setDays(d); load(d); }}
          className="border rounded-lg px-2 py-1.5 text-sm bg-white"
        >
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
          <option value={30}>Next 30 days</option>
          <option value={60}>Next 60 days</option>
          {defaultDays !== null && ![7, 14, 30, 60].includes(defaultDays) && (
            <option value={defaultDays}>Next {defaultDays} days (default)</option>
          )}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <CalendarClock className="h-10 w-10 opacity-40" />
            <p>Nothing due or overdue in this window</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overdue ({overdue.length})
                </p>
                <div className="space-y-2">
                  {overdue.map((j) => <DueRow key={j.id} job={j} />)}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Upcoming ({upcoming.length})
                </p>
                <div className="space-y-2">
                  {upcoming.map((j) => <DueRow key={j.id} job={j} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DueRow({ job }: { job: DueJob }) {
  return (
    <div className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 ${job.overdue ? 'border-red-200' : ''}`}>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{job.warranty.product.name}</p>
        <p className="text-sm text-gray-500">{job.warranty.customer.name} · {job.warranty.customer.phone}</p>
        {job.assignedTo && <p className="text-xs text-gray-400 mt-0.5">Assigned to {job.assignedTo.name}</p>}
      </div>
      <span className={`text-xs font-semibold shrink-0 ${job.overdue ? 'text-red-600' : 'text-gray-500'}`}>
        {new Date(job.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
      </span>
    </div>
  );
}
