'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart2, Users, Wallet, IndianRupee, TrendingDown, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { StaffPerformance } from '@/components/service/StaffPerformance';
import { CustomerServiceReport } from '@/components/service/CustomerServiceReport';

interface Report {
  totals: { expense: number; charge: number; net: number; jobCount: number };
  byStaff: Array<{ staffId: string; staffName: string; expense: number; charge: number; jobCount: number }>;
  byCustomer: Array<{ customerId: string; customerName: string; expense: number; charge: number; jobCount: number }>;
  byMonth: Array<{ month: string; expense: number; charge: number }>;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function fmt(v: number) {
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RANGES = [
  { label: 'This Month', id: 'month' },
  { label: 'Custom', id: 'custom' },
] as const;

// Service Reports: staff performance (default), customers, and money in / out.
export default function ServiceReportsPage() {
  const [view, setView] = useState<'staff' | 'customers' | 'money'>('staff');
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex gap-1 border-b bg-white px-4 pt-3 sm:px-6">
        {([['staff', 'Staff performance'], ['customers', 'Customers'], ['money', 'Money in / out']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${view === k ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {view === 'money' ? (
          <MoneyReport />
        ) : view === 'customers' ? (
          <div className="h-full overflow-auto p-4 sm:p-6">
            <h1 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900"><Users className="h-5 w-5 text-red-700" /> Customers</h1>
            <CustomerServiceReport />
          </div>
        ) : (
          <div className="h-full overflow-auto p-4 sm:p-6">
            <h1 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900"><BarChart2 className="h-5 w-5 text-red-700" /> Staff performance</h1>
            <StaffPerformance />
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyReport() {
  const { user } = useAuthStore();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [range, setRange] = useState<'month' | 'custom'>('month');
  const [from, setFrom] = useState(iso(firstOfMonth));
  const [to, setTo] = useState(iso(now));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const applyRange = (r: 'month' | 'custom') => {
    setRange(r);
    if (r === 'month') { setFrom(iso(firstOfMonth)); setTo(iso(now)); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/warranty/reports/service-expenses', { params: { from, to } });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const storeName = user?.store?.name || 'My Store';
  const rangeLabel = range === 'month' ? 'This Month' : `${from} to ${to}`;
  const dateTag = iso(now);

  const exportCsv = () => {
    if (!report) return;
    const esc = (v: string | number) => {
      const str = String(v ?? '');
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const rows: string[] = [
      `# ${storeName} — Service Report`,
      `# Period: ${rangeLabel}`,
      '',
      '## Summary',
      'Metric,Value',
      `Money In (charged),${report.totals.charge}`,
      `Money Out (staff expenses),${report.totals.expense}`,
      `Net,${report.totals.net}`,
      `Visits,${report.totals.jobCount}`,
      '',
      '## Expenses per Staff',
      'Name,Visits,Charged,Expense',
      ...report.byStaff.map((r) => [esc(r.staffName), r.jobCount, r.charge, r.expense].join(',')),
      '',
      '## Expenses per Customer',
      'Name,Visits,Charged,Expense',
      ...report.byCustomer.map((r) => [esc(r.customerName), r.jobCount, r.charge, r.expense].join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-report-${dateTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!report) return;
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const summarySheet = utils.aoa_to_sheet([
      ['Metric', 'Value'],
      ['Money In (charged)', report.totals.charge],
      ['Money Out (staff expenses)', report.totals.expense],
      ['Net', report.totals.net],
      ['Visits', report.totals.jobCount],
    ]);
    utils.book_append_sheet(wb, summarySheet, 'Summary');
    const staffSheet = utils.aoa_to_sheet([
      ['Name', 'Visits', 'Charged', 'Expense'],
      ...report.byStaff.map((r) => [r.staffName, r.jobCount, r.charge, r.expense]),
    ]);
    utils.book_append_sheet(wb, staffSheet, 'By Staff');
    const customerSheet = utils.aoa_to_sheet([
      ['Name', 'Visits', 'Charged', 'Expense'],
      ...report.byCustomer.map((r) => [r.customerName, r.jobCount, r.charge, r.expense]),
    ]);
    utils.book_append_sheet(wb, customerSheet, 'By Customer');
    writeFile(wb, `service-report-${dateTag}.xlsx`);
  };

  const exportPdf = async () => {
    if (!report || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFillColor(127, 29, 29);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(storeName, 14, 8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Service Report · Period: ${rangeLabel}`, 14, 14);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 18);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: 26,
        head: [['Metric', 'Value']],
        body: [
          ['Money In (charged)', fmt(report.totals.charge)],
          ['Money Out (staff expenses)', fmt(report.totals.expense)],
          ['Net', fmt(report.totals.net)],
          ['Visits', String(report.totals.jobCount)],
        ],
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Staff', 'Visits', 'Charged', 'Expense']],
        body: report.byStaff.map((r) => [r.staffName, String(r.jobCount), fmt(r.charge), fmt(r.expense)]),
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Customer', 'Visits', 'Charged', 'Expense']],
        body: report.byCustomer.map((r) => [r.customerName, String(r.jobCount), fmt(r.charge), fmt(r.expense)]),
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
      });

      doc.save(`service-report-${dateTag}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="h-5 w-5 text-red-700" /> Service Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => applyRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.id ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
            </div>
          )}
          <button
            onClick={exportCsv}
            disabled={!report}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700"
          >
            <FileDown className="h-3.5 w-3.5 text-green-600" /> CSV
          </button>
          <button
            onClick={exportExcel}
            disabled={!report}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={!report || pdfLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50"
          >
            <FileText className={`h-3.5 w-3.5 ${pdfLoading ? 'animate-pulse' : ''}`} /> {pdfLoading ? 'Generating…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {loading || !report ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Money In (charged)" value={fmt(report.totals.charge)} color="text-green-700" />
              <StatCard icon={<TrendingDown className="h-4 w-4" />} label="Money Out (staff expenses)" value={fmt(report.totals.expense)} color="text-red-700" />
              <StatCard icon={<IndianRupee className="h-4 w-4" />} label="Net" value={fmt(report.totals.net)} color={report.totals.net >= 0 ? 'text-green-700' : 'text-red-700'} />
            </div>

            {/* Monthly chart */}
            {report.byMonth.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Money In vs Out by Month</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="charge" name="Money In" fill="#16a34a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Money Out" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* By staff */}
            <ReportTable
              title="Expenses per Staff"
              rows={report.byStaff}
              nameKey="staffName"
              emptyMessage="No service visits in this range"
            />

            {/* By customer */}
            <ReportTable
              title="Expenses per Customer"
              rows={report.byCustomer}
              nameKey="customerName"
              emptyMessage="No service visits in this range"
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">{icon} {label}</div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ReportTable({
  title, rows, nameKey, emptyMessage,
}: {
  title: string;
  rows: Array<{ expense: number; charge: number; jobCount: number } & Record<string, any>>;
  nameKey: string;
  emptyMessage: string;
}) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-400 text-center">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Visits</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Charged</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-gray-900">{r[nameKey]}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{r.jobCount}</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(r.charge)}</td>
                  <td className="px-4 py-2 text-right text-red-700">{fmt(r.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
