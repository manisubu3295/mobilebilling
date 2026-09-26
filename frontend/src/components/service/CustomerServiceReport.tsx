'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Phone, Search } from 'lucide-react';
import api from '@/lib/api';
import { localDateString } from '@/lib/local-date';
import { CustomerDrawer } from '@/components/service/CustomerDrawer';
import { monthStart, Period, periodDates, PeriodPicker } from '@/components/service/PeriodPicker';

interface Row {
  customer: { id: string; name: string; phone: string; cardNo: string | null; address: string | null; city: string | null };
  amcs: Array<{ id: string; product: string; status: string }>;
  activeAmcs: number;
  nextVisit: { id: string; dueDate: string; status: string; product: string; technician: string | null; overdue: boolean } | null;
  openVisits: number;
  overdueVisits: number;
  unassignedVisits: number;
  visitsInPeriod: number;
  lastVisit: string | null;
  technicians: Array<{ id: string; name: string }>;
  totalBusiness: number;
  outstanding: number;
}

interface Report {
  totals: { customers: number; overdue: number; unassigned: number; withDue: number; outstanding: number };
  customers: Row[];
}

type Chip = 'ALL' | 'OVERDUE' | 'UNASSIGNED' | 'DUE';

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateText = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Customer-level service view: who has AMCs, what's next and who is on it,
// what's overdue and what money is due. Tap a customer for everything.
export function CustomerServiceReport() {
  const [period, setPeriod] = useState<Period>('MONTH');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(localDateString());
  const [search, setSearch] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [chip, setChip] = useState<Chip>('ALL');
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/users/technicians').then(({ data }) => setStaff(data)).catch(() => setStaff([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Report>('/warranty/reports/customers', {
        params: { ...periodDates(period, from, to), search: search.trim() || undefined, technicianId: technicianId || undefined },
      });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [period, from, to, search, technicianId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const rows = (report?.customers ?? []).filter((r) =>
    chip === 'OVERDUE' ? r.overdueVisits > 0
    : chip === 'UNASSIGNED' ? r.unassignedVisits > 0
    : chip === 'DUE' ? r.outstanding > 0
    : true);
  const t = report?.totals;

  return (
    <div className="space-y-4">
      <PeriodPicker period={period} from={from} to={to} onPeriod={setPeriod} onFrom={setFrom} onTo={setTo} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or card no"
            className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm"
          />
        </label>
        <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-lg border px-2 py-2 text-sm">
          <option value="">All technicians</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['ALL', `All customers${t ? ` (${t.customers})` : ''}`],
          ['OVERDUE', `Service overdue${t ? ` (${t.overdue})` : ''}`],
          ['UNASSIGNED', `Needs a technician${t ? ` (${t.unassigned})` : ''}`],
          ['DUE', `Money due${t ? ` (${t.withDue} · ${money(t.outstanding)})` : ''}`],
        ] as [Chip, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setChip(k)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${chip === k ? 'bg-gray-900 text-white' : 'border bg-white text-gray-600'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading && !report ? (
        <p className="py-10 text-center text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-gray-400">No customers match</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const c = r.customer;
            return (
              <button
                key={c.id}
                onClick={() => setCustomerId(c.id)}
                className="block w-full rounded-xl border bg-white p-3 text-left hover:border-red-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {c.cardNo && <span className="mr-1 font-mono text-xs text-blue-700">#{c.cardNo}</span>}
                      {c.name}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>
                      {[c.address, c.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    {r.outstanding > 0 ? <p className="font-semibold text-red-600">Due {money(r.outstanding)}</p> : <p className="text-gray-400">No dues</p>}
                    <p className="text-gray-400">Business {money(r.totalBusiness)}</p>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-gray-400">AMC / products</p>
                    <p className="text-gray-700">
                      {r.amcs.length ? r.amcs.map((a) => a.product).join(', ') : '—'}
                      {r.amcs.length > 0 && <span className="text-gray-400"> · {r.activeAmcs} active</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Next visit</p>
                    {r.nextVisit ? (
                      <p className={r.nextVisit.overdue ? 'font-semibold text-red-600' : 'text-gray-700'}>
                        {dateText(r.nextVisit.dueDate)}{r.nextVisit.overdue ? ' · overdue' : ''}
                        <span className={r.nextVisit.technician ? 'text-gray-500' : 'text-amber-600'}>
                          {' · '}{r.nextVisit.technician ?? 'not assigned'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-gray-400">None scheduled</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400">Service</p>
                    <p className="text-gray-700">
                      {r.visitsInPeriod} done in period
                      {r.overdueVisits > 0 && <span className="text-red-600"> · {r.overdueVisits} overdue</span>}
                      {r.lastVisit && <span className="text-gray-400"> · last {dateText(r.lastVisit)}</span>}
                    </p>
                    {r.technicians.length > 0 && <p className="text-gray-500">By {r.technicians.map((x) => x.name).join(', ')}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {customerId && <CustomerDrawer customerId={customerId} onClose={() => setCustomerId(null)} />}
    </div>
  );
}
