'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { localDateString } from '@/lib/local-date';

interface StaffRow {
  staffId: string;
  name: string;
  isActive: boolean;
  assigned: number;
  completed: number;
  onTime: number;
  overdueOpen: number;
  billsCount: number;
  billed: number;
  expenses: number;
  requests: number;
  onTimePct: number;
  completionPct: number;
  billingPct: number;
  score: number | null;
  visits: Array<{ id: string; dueDate: string; closedAt: string; onTime: boolean; customer: string; cardNo: string | null; product: string; feedback: string | null }>;
}

interface Report { teamAvgBilled: number; staff: StaffRow[] }

type Period = 'WEEK' | 'MONTH' | 'CUSTOM';

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateText = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function periodDates(p: Period, from: string, to: string) {
  const now = new Date();
  if (p === 'WEEK') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: localDateString(monday), to: localDateString(now) };
  }
  if (p === 'MONTH') return { from: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDateString(now) };
  return { from, to };
}

function scoreTone(score: number | null) {
  if (score === null) return 'bg-gray-100 text-gray-500';
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

// Per-technician work and a performance score for a week / month / custom
// period. Score = 40% on-time + 30% completion + 30% billing vs team average.
export function StaffPerformance() {
  const [period, setPeriod] = useState<Period>('MONTH');
  const [from, setFrom] = useState(localDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(localDateString());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Report>('/warranty/reports/staff', { params: periodDates(period, from, to) });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['WEEK', 'This week'], ['MONTH', 'This month'], ['CUSTOM', 'Custom']] as [Period, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === k ? 'bg-red-700 text-white' : 'bg-white border text-gray-700'}`}
          >
            {l}
          </button>
        ))}
        {period === 'CUSTOM' && (
          <span className="flex items-center gap-1 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border px-2 py-1" />
            to
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border px-2 py-1" />
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Score out of 100 = 40% visits done on time + 30% assigned visits completed + 30% amount billed compared with the team average
        {report ? ` (${money(report.teamAvgBilled)})` : ''}.
      </p>

      {loading ? (
        <p className="py-10 text-center text-gray-400">Loading…</p>
      ) : !report || report.staff.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No technicians yet — add them under Users with the Service Staff role.</p>
      ) : (
        <div className="space-y-3">
          {report.staff.map((s, i) => {
            const open = openId === s.staffId;
            return (
              <div key={s.staffId} className="rounded-xl border bg-white">
                <button onClick={() => setOpenId(open ? null : s.staffId)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
                  <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${scoreTone(s.score)}`}>
                    <span className="text-lg leading-none">{s.score ?? '—'}</span>
                    <span className="text-[9px] font-medium uppercase">score</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                      {i === 0 && s.score !== null && <Trophy className="h-4 w-4 text-amber-500" />}
                      {s.name}
                      {!s.isActive && <span className="text-xs font-normal text-gray-400">(inactive)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.completed}/{s.assigned} visits done · {s.onTimePct}% on time · {s.billsCount} bills · {money(s.billed)} billed
                    </p>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                <div className="grid grid-cols-3 gap-px border-t bg-gray-100 text-center text-xs sm:grid-cols-6">
                  {[
                    ['Assigned', s.assigned],
                    ['Completed', `${s.completed} (${s.completionPct}%)`],
                    ['On time', `${s.onTime} (${s.onTimePct}%)`],
                    ['Overdue now', s.overdueOpen],
                    ['Billed', `${money(s.billed)} · ${s.billsCount}`],
                    ['Expenses', money(s.expenses)],
                  ].map(([label, value]) => (
                    <div key={label as string} className="bg-white p-2">
                      <p className="text-gray-400">{label}</p>
                      <p className={`font-semibold ${label === 'Overdue now' && s.overdueOpen > 0 ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {open && (
                  <div className="border-t p-4">
                    <p className="mb-2 text-xs text-gray-500">{s.requests} service request{s.requests === 1 ? '' : 's'} raised in this period</p>
                    {s.visits.length === 0 ? (
                      <p className="text-sm text-gray-400">No visits completed in this period</p>
                    ) : (
                      <div className="divide-y text-sm">
                        {s.visits.map((v) => (
                          <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span>
                              {v.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{v.cardNo}</span>}
                              {v.customer} · {v.product}
                              {v.feedback && <span className="block text-xs text-gray-500">&ldquo;{v.feedback}&rdquo;</span>}
                            </span>
                            <span className={`text-xs ${v.onTime ? 'text-green-700' : 'text-red-600'}`}>
                              due {dateText(v.dueDate)} · done {dateText(v.closedAt)} {v.onTime ? '✓ on time' : '· late'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
