'use client';

import React from 'react';
import { localDateString } from '@/lib/local-date';

export type Period = 'WEEK' | 'MONTH' | 'CUSTOM';

export const monthStart = () => localDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

// The from/to dates (local calendar days) a period stands for.
export function periodDates(p: Period, from: string, to: string) {
  const now = new Date();
  if (p === 'WEEK') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: localDateString(monday), to: localDateString(now) };
  }
  if (p === 'MONTH') return { from: monthStart(), to: localDateString(now) };
  return { from, to };
}

// This week / This month / Custom from–to, shared by the service reports.
export function PeriodPicker({ period, from, to, onPeriod, onFrom, onTo }: {
  period: Period; from: string; to: string;
  onPeriod: (p: Period) => void; onFrom: (d: string) => void; onTo: (d: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {([['WEEK', 'This week'], ['MONTH', 'This month'], ['CUSTOM', 'Custom']] as [Period, string][]).map(([k, l]) => (
        <button
          key={k}
          onClick={() => onPeriod(k)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === k ? 'bg-red-700 text-white' : 'border bg-white text-gray-700'}`}
        >
          {l}
        </button>
      ))}
      {period === 'CUSTOM' && (
        <span className="flex items-center gap-1 text-sm">
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="rounded-lg border px-2 py-1" />
          to
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="rounded-lg border px-2 py-1" />
        </span>
      )}
    </div>
  );
}
