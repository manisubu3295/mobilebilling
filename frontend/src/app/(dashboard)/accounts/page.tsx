'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Wallet, AlertCircle, FileX, CreditCard,
  Banknote, Smartphone, ArrowDownCircle, Calendar, RefreshCw,
  FileDown, FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Summary {
  totalRevenue: string;
  collected: string;
  outstanding: string;
  invoiceCount: number;
  cancelledCount: number;
}

interface ModeRow  { mode: string; amount: string; }
interface DayRow   { date: string; amount: string; count: number; }
interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  customer: { name: string; phone: string; vehicleNo?: string } | null;
  createdBy: { name: string } | null;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  createdAt: string;
  status: string;
}

interface CollectionsData {
  summary: Summary;
  byMode: ModeRow[];
  byDay: DayRow[];
  outstandingInvoices: OutstandingInvoice[];
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const RANGES = [
  { label: 'Today',      id: 'today' },
  { label: 'This Week',  id: 'week' },
  { label: 'This Month', id: 'month' },
  { label: 'Custom',     id: 'custom' },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const MODE_ICON: Record<string, React.ReactNode> = {
  CASH:          <Banknote className="h-4 w-4" />,
  UPI:           <Smartphone className="h-4 w-4" />,
  CREDIT_CARD:   <CreditCard className="h-4 w-4" />,
  DEBIT_CARD:    <CreditCard className="h-4 w-4" />,
  BANK_TRANSFER: <ArrowDownCircle className="h-4 w-4" />,
  EMI:           <Calendar className="h-4 w-4" />,
};
const MODE_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card', BANK_TRANSFER: 'Bank Transfer', EMI: 'EMI',
};

function fmt(v: string | number) {
  return '₹' + parseFloat(String(v)).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtNum(v: string | number) {
  return 'Rs.' + parseFloat(String(v)).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function getRangeDates(range: RangeId, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (range === 'today') {
    const d = iso(now);
    return { from: `${d}T00:00:00.000Z`, to: now.toISOString() };
  }
  if (range === 'week') {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    return { from: mon.toISOString(), to: now.toISOString() };
  }
  if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: first.toISOString(), to: now.toISOString() };
  }
  // custom
  return {
    from: customFrom ? `${customFrom}T00:00:00.000Z` : `${iso(now)}T00:00:00.000Z`,
    to:   customTo   ? `${customTo}T23:59:59.999Z`   : now.toISOString(),
  };
}

/* ── Sub-components ────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, sub, color,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>{icon}</div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */
export default function AccountsPage() {
  const { user }                  = useAuthStore();
  const [range, setRange]         = useState<RangeId>('today');
  const [customFrom, setFrom]     = useState('');
  const [customTo, setTo]         = useState('');
  const [data, setData]           = useState<CollectionsData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getRangeDates(range, customFrom, customTo);
      const { data: res } = await api.get<CollectionsData>(
        `/billing/collections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setData(res);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load collections data');
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const dateTag = new Date().toISOString().slice(0, 10);
  const storeName = user?.store?.name || 'Aadhirai Royal Enfield';

  const rangeLabel = (() => {
    if (range !== 'custom') return RANGES.find((r) => r.id === range)?.label ?? range;
    return customFrom && customTo ? `${customFrom} to ${customTo}` : 'Custom Range';
  })();

  /* ── CSV export ─────────────────────────────────────────────────── */
  const exportCsv = () => {
    if (!data) return;
    const s = data.summary;
    const esc = (v: string | number) => {
      const str = String(v ?? '');
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const rows: string[] = [
      `# ${storeName} — Accounts & Collections Report`,
      `# Period: ${rangeLabel}`,
      `# Generated: ${new Date().toLocaleString('en-IN')}`,
      '',
      '## Summary',
      'Metric,Value',
      `Total Billed,${s.totalRevenue}`,
      `Collected,${s.collected}`,
      `Outstanding,${s.outstanding}`,
      `Invoice Count,${s.invoiceCount}`,
      `Cancelled,${s.cancelledCount}`,
      '',
      '## Daily Collections',
      'Date,Invoice Count,Collected (INR)',
      ...[...data.byDay].reverse().map((r) =>
        [esc(new Date(r.date + 'T12:00:00').toLocaleDateString('en-IN')), r.count, r.amount].join(',')
      ),
      '',
      '## Payment Mode Breakdown',
      'Mode,Amount (INR)',
      ...data.byMode.map((r) => [esc(MODE_LABEL[r.mode] || r.mode), r.amount].join(',')),
      '',
      '## Outstanding Invoices',
      'Invoice No,Customer,Phone,Vehicle,Total (INR),Paid (INR),Balance (INR),Date,Status',
      ...data.outstandingInvoices.map((inv) =>
        [
          inv.invoiceNumber,
          esc(inv.customer?.name || 'Walk-in'),
          esc(inv.customer?.phone || ''),
          esc(inv.customer?.vehicleNo || ''),
          inv.totalAmount,
          inv.paidAmount,
          inv.balance,
          new Date(inv.createdAt).toLocaleDateString('en-IN'),
          inv.status,
        ].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `collections-${range}-${dateTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── PDF export ─────────────────────────────────────────────────── */
  const exportPdf = async () => {
    if (!data || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const s   = data.summary;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W   = 210;
      let y     = 0;

      /* ── Header band ── */
      doc.setFillColor(127, 29, 29);
      doc.rect(0, 0, W, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(storeName, 14, 9);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Accounts & Collections Report', 14, 15);
      doc.text(`Period: ${rangeLabel}`, 14, 20);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, W - 14, 20, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y = 28;

      /* ── Summary box ── */
      const totalRev  = parseFloat(s.totalRevenue);
      const collected = parseFloat(s.collected);
      const pct = totalRev > 0 ? ((collected / totalRev) * 100).toFixed(1) + '%' : '—';

      const summaryData = [
        ['Total Billed',   fmtNum(s.totalRevenue), `${s.invoiceCount} invoices`],
        ['Collected',      fmtNum(s.collected),     `${pct} of billed`],
        ['Outstanding',    fmtNum(s.outstanding),   `${data.outstandingInvoices.length} pending`],
        ['Cancelled',      String(s.cancelledCount), ''],
        ['Avg Invoice',    s.invoiceCount > 0 ? fmtNum((totalRev / s.invoiceCount).toFixed(2)) : '₹0.00', ''],
      ];

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Amount', 'Note']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold' },
          1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
          2: { cellWidth: 60, textColor: [100, 100, 100] },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      /* ── Payment Mode Breakdown ── */
      if (data.byMode.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(127, 29, 29);
        doc.text('Payment Mode Breakdown', 14, y);
        doc.setTextColor(0, 0, 0);
        y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Payment Mode', 'Amount Collected', '% of Total']],
          body: data.byMode.map((r) => {
            const amt = parseFloat(r.amount);
            const p   = collected > 0 ? ((amt / collected) * 100).toFixed(1) + '%' : '—';
            return [MODE_LABEL[r.mode] || r.mode, fmtNum(r.amount), p];
          }),
          theme: 'striped',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8.5 },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
            2: { cellWidth: 40, halign: 'center' },
          },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      /* ── Daily Collections ── */
      if (data.byDay.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(127, 29, 29);
        doc.text('Daily Collections', 14, y);
        doc.setTextColor(0, 0, 0);
        y += 3;

        const dayTotal = data.byDay.reduce((sum, r) => sum + parseFloat(r.amount), 0);

        autoTable(doc, {
          startY: y,
          head: [['Date', 'Invoices', 'Collected']],
          body: [
            ...[...data.byDay].reverse().map((r) => [
              new Date(r.date + 'T12:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
              }),
              String(r.count),
              fmtNum(r.amount),
            ]),
            ['TOTAL', String(s.invoiceCount), fmtNum(dayTotal.toFixed(2))],
          ],
          theme: 'striped',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8.5 },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (d: any) => {
            if (d.row.index === data.byDay.length) {
              d.cell.styles.fillColor = [127, 29, 29];
              d.cell.styles.textColor = [255, 255, 255];
              d.cell.styles.fontStyle = 'bold';
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      /* ── Outstanding Invoices ── */
      if (data.outstandingInvoices.length > 0) {
        // Add page if little space left
        if (y > 220) { doc.addPage(); y = 14; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(127, 29, 29);
        doc.text('Outstanding / Credit Invoices', 14, y);
        doc.setTextColor(0, 0, 0);
        y += 3;

        const outTotal = data.outstandingInvoices.reduce((s, inv) => s + parseFloat(inv.balance), 0);

        autoTable(doc, {
          startY: y,
          head: [['Invoice No', 'Customer', 'Vehicle', 'Total', 'Paid', 'Balance Due', 'Date']],
          body: [
            ...data.outstandingInvoices.map((inv) => [
              inv.invoiceNumber,
              inv.customer?.name || 'Walk-in',
              inv.customer?.vehicleNo || '—',
              fmtNum(inv.totalAmount),
              fmtNum(inv.paidAmount),
              fmtNum(inv.balance),
              new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            ]),
            ['', 'TOTAL OUTSTANDING', '', '', '', fmtNum(outTotal.toFixed(2)), ''],
          ],
          theme: 'striped',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [255, 251, 235] },
          columnStyles: {
            0: { cellWidth: 28, fontStyle: 'bold', textColor: [127, 29, 29] },
            1: { cellWidth: 38 },
            2: { cellWidth: 24, halign: 'center' },
            3: { cellWidth: 26, halign: 'right' },
            4: { cellWidth: 26, halign: 'right', textColor: [22, 163, 74] },
            5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
            6: { cellWidth: 24, halign: 'center' },
          },
          margin: { left: 14, right: 14 },
          didParseCell: (d: any) => {
            if (d.row.index === data.outstandingInvoices.length) {
              d.cell.styles.fillColor = [254, 243, 199];
              d.cell.styles.fontStyle = 'bold';
            }
          },
        });
      }

      /* ── Page footer ── */
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160);
        doc.text(
          `Page ${i} of ${pageCount}  ·  ${storeName} — Accounts & Collections`,
          14,
          (doc as any).internal.pageSize.height - 6,
        );
      }

      doc.save(`collections-${range}-${dateTag}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const s = data?.summary;
  const totalRev  = parseFloat(s?.totalRevenue  || '0');
  const collected = parseFloat(s?.collected      || '0');

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 space-y-5">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Accounts &amp; Collections</h1>
            <p className="text-sm text-gray-500 mt-0.5">Revenue, payment mode breakdown and outstanding amounts</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700"
            >
              <FileDown className="h-4 w-4 text-green-600" />
              CSV
            </button>
            <button
              onClick={exportPdf}
              disabled={!data || pdfLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50"
            >
              <FileText className={`h-4 w-4 ${pdfLoading ? 'animate-pulse' : ''}`} />
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* ── Range selector ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  range === r.id
                    ? 'bg-red-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
            {range === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {loading && !data && (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-8 w-8 text-gray-300 animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* ── Summary cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-gray-700" />}
                label="Total Billed"
                value={fmt(s!.totalRevenue)}
                sub={`${s!.invoiceCount} invoice${s!.invoiceCount !== 1 ? 's' : ''}`}
                color="text-gray-800"
              />
              <StatCard
                icon={<Wallet className="h-5 w-5 text-green-700" />}
                label="Collected"
                value={fmt(s!.collected)}
                sub={totalRev > 0 ? `${((collected / totalRev) * 100).toFixed(0)}% of billed` : undefined}
                color="text-green-700"
              />
              <StatCard
                icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
                label="Outstanding"
                value={fmt(s!.outstanding)}
                sub={data.outstandingInvoices.length > 0 ? `${data.outstandingInvoices.length} pending` : 'All clear'}
                color={parseFloat(s!.outstanding) > 0 ? 'text-amber-600' : 'text-green-600'}
              />
              <StatCard
                icon={<FileX className="h-5 w-5 text-red-500" />}
                label="Cancelled"
                value={String(s!.cancelledCount)}
                color="text-red-500"
              />
              <StatCard
                icon={<CreditCard className="h-5 w-5 text-indigo-600" />}
                label="Avg Invoice"
                value={s!.invoiceCount > 0 ? fmt(totalRev / s!.invoiceCount) : '₹0.00'}
                color="text-indigo-600"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Payment Mode Breakdown ──────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Payment Mode Breakdown</h2>
                </div>
                {data.byMode.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No payments in this period</p>
                ) : (
                  <div className="p-4 space-y-3">
                    {data.byMode.map((row) => {
                      const pct = collected > 0
                        ? (parseFloat(row.amount) / collected) * 100
                        : 0;
                      return (
                        <div key={row.mode}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-2 text-sm text-gray-700">
                              <span className="text-gray-500">{MODE_ICON[row.mode] ?? <CreditCard className="h-4 w-4" />}</span>
                              {MODE_LABEL[row.mode] || row.mode}
                            </span>
                            <span className="font-semibold text-sm text-gray-900">{fmt(row.amount)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-red-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 text-right">{pct.toFixed(1)}%</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Daily Collection Trend ─────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Daily Collections</h2>
                </div>
                {data.byDay.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No data in this period</p>
                ) : (
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Bills</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...data.byDay].reverse().map((row) => (
                          <tr key={row.date} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-700">
                              {new Date(row.date + 'T12:00:00').toLocaleDateString('en-IN', {
                                weekday: 'short', day: '2-digit', month: 'short',
                              })}
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-500">{row.count}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmt(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td className="px-4 py-2 font-bold text-gray-700 text-xs uppercase">Total</td>
                          <td className="px-4 py-2 text-center font-bold text-gray-700">{s!.invoiceCount}</td>
                          <td className="px-4 py-2 text-right font-bold text-green-700">{fmt(s!.collected)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Outstanding / Credit Invoices ───────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 text-sm">Outstanding / Credit Invoices</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Invoices with pending balance due</p>
                </div>
                {data.outstandingInvoices.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                    {data.outstandingInvoices.length} pending
                  </span>
                )}
              </div>

              {data.outstandingInvoices.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="h-10 w-10 text-green-200 mx-auto mb-2" />
                  <p className="text-green-600 font-medium text-sm">All invoices are fully collected!</p>
                  <p className="text-gray-400 text-xs mt-1">No outstanding balances in this period.</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-50">
                    {data.outstandingInvoices.map((inv) => (
                      <div key={inv.id} className="p-4 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs text-red-700 font-bold">{inv.invoiceNumber}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-gray-800">
                          {inv.customer?.name || 'Walk-in Customer'}
                          {inv.customer?.vehicleNo && (
                            <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">
                              {inv.customer.vehicleNo}
                            </span>
                          )}
                        </p>
                        {inv.customer?.phone && <p className="text-xs text-gray-500">{inv.customer.phone}</p>}
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-gray-500">Total: <strong>{fmt(inv.totalAmount)}</strong></span>
                          <span className="text-green-600">Paid: <strong>{fmt(inv.paidAmount)}</strong></span>
                          <span className="text-amber-600 font-bold">Due: {fmt(inv.balance)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Vehicle</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Balance Due</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Billed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.outstandingInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-red-700 font-bold">
                              {inv.invoiceNumber}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{inv.customer?.name || 'Walk-in'}</p>
                              {inv.customer?.phone && (
                                <p className="text-xs text-gray-400">{inv.customer.phone}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {inv.customer?.vehicleNo ? (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-mono font-semibold">
                                  {inv.customer.vehicleNo}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(inv.totalAmount)}</td>
                            <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(inv.paidAmount)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold text-sm">
                                {fmt(inv.balance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {inv.createdBy?.name || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-2.5 font-bold text-gray-700 text-xs uppercase">
                            Total Outstanding
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-800 rounded-md font-bold text-sm">
                              {fmt(s!.outstanding)}
                            </span>
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
