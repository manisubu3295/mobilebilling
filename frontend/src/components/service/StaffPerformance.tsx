'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { localDateString } from '@/lib/local-date';
import { frequencyLabel } from '@/components/service/ServiceAdminModals';
import { CustomerDrawer, serviceTypeLabel, VisitStatus } from '@/components/service/CustomerDrawer';
import { monthStart, Period, periodDates, PeriodPicker } from '@/components/service/PeriodPicker';

interface ReportCustomer {
  id: string; name: string; phone: string; cardNo: string | null; address?: string | null; city?: string | null; landmark?: string | null;
}

interface ReportJob {
  id: string; status: string; dueDate: string; visitDate: string | null; closedAt: string | null;
  isExtra: boolean; serviceCategory: string | null; requestNote: string | null; feedback: string | null; expense: number;
  product: string; serviceFrequency: string | null; frequencyMonths: number | null;
  customer: ReportCustomer; parts: string[];
  bill: { id: string; billNo: string | null; total: number; due: number } | null;
  flags: { inPeriod: boolean; todo: boolean; done: boolean; onTime: boolean; overdue: boolean };
}

interface StaffRow {
  staffId: string; name: string; phone: string | null; isActive: boolean;
  assigned: number; todo: number; completed: number; onTime: number; overdueOpen: number;
  billsCount: number; billed: number; expenses: number; requests: number;
  onTimePct: number; completionPct: number; billingPct: number; score: number | null;
  jobs: ReportJob[];
  bills: Array<{ id: string; billNo: string; date: string; customer: ReportCustomer | null; total: number; due: number }>;
}

interface Report { teamAvgBilled: number; staff: StaffRow[] }

// Which list a number on the card opens.
type Bucket = 'ASSIGNED' | 'TODO' | 'DONE' | 'ONTIME' | 'LATE' | 'OVERDUE' | 'BILLS';

const BUCKETS: Array<{ key: Bucket; label: string; hint: string; pick: (j: ReportJob) => boolean }> = [
  { key: 'ASSIGNED', label: 'Assigned', hint: 'Visits due or done in this period', pick: (j) => j.flags.inPeriod },
  { key: 'TODO', label: 'To do', hint: 'Due in this period, not done yet', pick: (j) => j.flags.todo },
  { key: 'DONE', label: 'Completed', hint: 'Visits closed in this period', pick: (j) => j.flags.done },
  { key: 'ONTIME', label: 'On time', hint: 'Closed on or before the due date', pick: (j) => j.flags.done && j.flags.onTime },
  { key: 'LATE', label: 'Late', hint: 'Closed after the due date', pick: (j) => j.flags.done && !j.flags.onTime },
  { key: 'OVERDUE', label: 'Overdue now', hint: 'Past due and still open (any date)', pick: (j) => j.flags.overdue },
];

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateText = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function scoreTone(score: number | null) {
  if (score === null) return 'bg-gray-100 text-gray-500';
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

// Per-technician work and a performance score for a week / month / custom
// period. Every number opens the visits (customers) behind it; a customer
// opens their full service record.
// Score = 40% on-time + 30% completion + 30% billing vs team average.
export function StaffPerformance() {
  const [period, setPeriod] = useState<Period>('MONTH');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(localDateString());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ staffId: string; bucket: Bucket } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

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

  const toggle = (staffId: string, bucket: Bucket) =>
    setOpen((o) => (o && o.staffId === staffId && o.bucket === bucket ? null : { staffId, bucket }));

  return (
    <div className="space-y-4">
      <PeriodPicker period={period} from={from} to={to} onPeriod={setPeriod} onFrom={setFrom} onTo={setTo} />

      <p className="text-xs text-gray-500">
        Tap any number to see the customers and visits behind it. Score out of 100 = 40% visits done on time + 30% assigned
        visits completed + 30% amount billed compared with the team average{report ? ` (${money(report.teamAvgBilled)})` : ''}.
      </p>

      {loading ? (
        <p className="py-10 text-center text-gray-400">Loading…</p>
      ) : !report || report.staff.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No technicians yet — add them under Users with the Service Staff role.</p>
      ) : (
        <div className="space-y-3">
          {report.staff.map((s, i) => {
            const bucket = open?.staffId === s.staffId ? open.bucket : null;
            const counts: Record<Bucket, number> = {
              ASSIGNED: s.assigned, TODO: s.todo, DONE: s.completed, ONTIME: s.onTime,
              LATE: s.completed - s.onTime, OVERDUE: s.overdueOpen, BILLS: s.billsCount,
            };
            return (
              <div key={s.staffId} className="overflow-hidden rounded-xl border bg-white">
                <button
                  onClick={() => toggle(s.staffId, 'ASSIGNED')}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                >
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
                      {s.completed}/{s.assigned} visits done · {s.onTimePct}% on time · {s.todo} to do · {money(s.billed)} billed
                      {s.requests > 0 && ` · ${s.requests} request${s.requests === 1 ? '' : 's'} raised`}
                    </p>
                  </div>
                  {bucket ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                <div className="grid grid-cols-4 gap-px border-t bg-gray-100 text-center text-xs sm:grid-cols-7">
                  {[...BUCKETS.map((b) => ({ key: b.key, label: b.label, hint: b.hint })), { key: 'BILLS' as Bucket, label: 'Bills', hint: 'Service bills raised in this period' }].map((b) => {
                    const active = bucket === b.key;
                    const alert = (b.key === 'OVERDUE' || b.key === 'LATE') && counts[b.key] > 0;
                    return (
                      <button
                        key={b.key}
                        onClick={() => toggle(s.staffId, b.key)}
                        title={b.hint}
                        className={`p-2 transition-colors ${active ? 'bg-red-50 ring-2 ring-inset ring-red-600' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <p className="text-gray-400">{b.label}</p>
                        <p className={`text-base font-bold ${alert ? 'text-red-600' : 'text-gray-800'}`}>{counts[b.key]}</p>
                        {b.key === 'BILLS' && <p className="text-[10px] text-gray-500">{money(s.billed)}</p>}
                      </button>
                    );
                  })}
                </div>

                {bucket && (
                  <div className="border-t bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-gray-600">
                      {bucket === 'BILLS' ? 'Service bills raised' : BUCKETS.find((b) => b.key === bucket)!.hint}
                      {s.expenses > 0 && bucket === 'DONE' && ` · expenses ${money(s.expenses)}`}
                    </p>
                    {bucket === 'BILLS' ? (
                      <BillList bills={s.bills} onCustomer={setCustomerId} />
                    ) : (
                      <JobList jobs={s.jobs.filter(BUCKETS.find((b) => b.key === bucket)!.pick)} onCustomer={setCustomerId} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {customerId && <CustomerDrawer customerId={customerId} onClose={() => setCustomerId(null)} />}
    </div>
  );
}

function JobList({ jobs, onCustomer }: { jobs: ReportJob[]; onCustomer: (id: string) => void }) {
  if (jobs.length === 0) return <p className="py-3 text-center text-sm text-gray-400">Nothing here</p>;
  return (
    <div className="space-y-2">
      {jobs.map((j) => {
        const c = j.customer;
        const address = [c.address, c.city].filter(Boolean).join(', ');
        const type = serviceTypeLabel(j.serviceCategory);
        return (
          <div key={j.id} className="rounded-lg border bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button onClick={() => onCustomer(c.id)} className="text-left">
                <span className="font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-red-600">
                  {c.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{c.cardNo}</span>}
                  {c.name}
                </span>
              </button>
              <VisitStatus status={j.status} dueDate={j.dueDate} />
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-600">
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-600"><Phone className="h-3 w-3" /> {c.phone}</a>
              {address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {address}{c.landmark ? ` · ${c.landmark}` : ''}</span>}
            </div>
            <p className="mt-1 text-xs text-gray-700">
              <span className="font-medium">{j.product}</span>
              {' · '}
              {j.isExtra ? 'Extra visit' : `Regular AMC visit${j.serviceFrequency ? ` (${frequencyLabel(j.serviceFrequency, j.frequencyMonths).toLowerCase()})` : ''}`}
              {type && ` · ${type}`}
            </p>
            <p className="text-xs text-gray-500">
              Due {dateText(j.dueDate)}
              {j.closedAt && ` · done ${dateText(j.visitDate ?? j.closedAt)}${j.flags.done ? (j.flags.onTime ? ' ✓ on time' : ' · late') : ''}`}
            </p>
            {j.requestNote && <p className="text-xs text-gray-500">Request: {j.requestNote}</p>}
            {j.parts.length > 0 && <p className="text-xs text-gray-500">Parts: {j.parts.join(', ')}</p>}
            {j.feedback && <p className="text-xs italic text-gray-500">&ldquo;{j.feedback}&rdquo;</p>}
            {j.bill && (
              <p className="text-xs">
                Bill <span className="font-mono text-red-700">{j.bill.billNo}</span> · {money(j.bill.total)}
                {j.bill.due > 0 && <span className="text-red-600"> · due {money(j.bill.due)}</span>}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BillList({ bills, onCustomer }: { bills: StaffRow['bills']; onCustomer: (id: string) => void }) {
  if (bills.length === 0) return <p className="py-3 text-center text-sm text-gray-400">No service bills in this period</p>;
  return (
    <div className="divide-y rounded-lg border bg-white">
      {bills.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-2 p-3 text-sm">
          <div className="min-w-0">
            <p className="font-mono text-xs text-red-700">{b.billNo} <span className="font-sans text-gray-400">· {dateText(b.date)}</span></p>
            {b.customer ? (
              <button onClick={() => onCustomer(b.customer!.id)} className="truncate text-left font-medium underline decoration-gray-300 underline-offset-2 hover:decoration-red-600">
                {b.customer.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{b.customer.cardNo}</span>}
                {b.customer.name}
              </button>
            ) : (
              <p className="text-gray-400">Walk-in</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold">{money(b.total)}</p>
            {b.due > 0 && <p className="text-xs text-red-600">due {money(b.due)}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
