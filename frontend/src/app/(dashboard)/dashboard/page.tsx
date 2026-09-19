'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, IndianRupee, FileWarning, ClipboardCheck,
  AlertTriangle, Package, ShoppingCart, ClipboardList, UserPlus,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface DashboardData {
  todaySales: number;
  todayCollected: number;
  outstandingAmount: number;
  outstandingCount: number;
  pendingApprovals: number;
  overdueJobs: number;
  upcomingJobs: number;
  lowStockCount: number;
}

// Each card shows its own figure from its own source page — never summed
// together. Accounts' revenue already includes billed service-job invoices,
// so adding it to a separate "service money" total would double-count.
export default function DashboardPage() {
  const { user, account } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const serviceOn = !!account?.serviceModuleEnabled;
        const [collectionsRes, lowStockRes, pendingRes, nearingRes] = await Promise.all([
          api.get('/billing/collections'),
          api.get('/inventory/low-stock'),
          serviceOn ? api.get('/warranty', { params: { status: 'PENDING_APPROVAL' } }) : Promise.resolve({ data: [] }),
          serviceOn ? api.get('/warranty/nearing-due') : Promise.resolve({ data: { overdueCount: 0, upcomingCount: 0 } }),
        ]);
        if (cancelled) return;

        const summary = collectionsRes.data.summary;
        setData({
          todaySales: parseFloat(summary.totalRevenue),
          todayCollected: parseFloat(summary.collected),
          outstandingAmount: parseFloat(summary.outstanding),
          outstandingCount: collectionsRes.data.outstandingInvoices?.length ?? 0,
          pendingApprovals: pendingRes.data.length ?? 0,
          overdueJobs: nearingRes.data.overdueCount ?? 0,
          upcomingJobs: nearingRes.data.upcomingCount ?? 0,
          lowStockCount: lowStockRes.data.length ?? 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [account?.serviceModuleEnabled]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-red-700" /> Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Today at a glance'}
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Link href="/billing/checkout" className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800">
            <ShoppingCart className="h-4 w-4" /> New Sale
          </Link>
          <Link href="/billing/quotations" className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <ClipboardList className="h-4 w-4" /> New Quotation
          </Link>
          {account?.serviceModuleEnabled && (
            <Link href="/service" className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <UserPlus className="h-4 w-4" /> Register AMC
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : !data ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Couldn't load dashboard data</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              href="/accounts"
              icon={<IndianRupee className="h-5 w-5 text-green-700" />}
              iconBg="bg-green-50"
              label="Today's Sales"
              value={fmt(data.todaySales)}
              sub={`${fmt(data.todayCollected)} collected`}
            />
            <Card
              href="/accounts"
              icon={<FileWarning className="h-5 w-5 text-amber-700" />}
              iconBg="bg-amber-50"
              label="Outstanding"
              value={fmt(data.outstandingAmount)}
              sub={`${data.outstandingCount} invoice${data.outstandingCount === 1 ? '' : 's'}`}
              alert={data.outstandingCount > 0}
            />
            <Card
              href="/inventory"
              icon={<Package className="h-5 w-5 text-red-700" />}
              iconBg="bg-red-50"
              label="Low Stock Alerts"
              value={String(data.lowStockCount)}
              sub={data.lowStockCount > 0 ? 'needs restocking' : 'all healthy'}
              alert={data.lowStockCount > 0}
            />
            {account?.serviceModuleEnabled && (
              <>
                <Card
                  href="/service"
                  icon={<ClipboardCheck className="h-5 w-5 text-blue-700" />}
                  iconBg="bg-blue-50"
                  label="Pending AMC Approvals"
                  value={String(data.pendingApprovals)}
                  sub="waiting for review"
                  alert={data.pendingApprovals > 0}
                />
                <Card
                  href="/service/notifications"
                  icon={<AlertTriangle className="h-5 w-5 text-red-700" />}
                  iconBg="bg-red-50"
                  label="Overdue Service Visits"
                  value={String(data.overdueJobs)}
                  sub={`${data.upcomingJobs} due soon`}
                  alert={data.overdueJobs > 0}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  href, icon, iconBg, label, value, sub, alert,
}: {
  href: string; icon: React.ReactNode; iconBg: string; label: string; value: string; sub: string; alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${alert ? 'border-red-200' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
      <p className={`text-xs mt-2 ${alert ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{sub}</p>
    </Link>
  );
}
