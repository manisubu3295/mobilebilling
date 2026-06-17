'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingCart, Package, Users, FileText,
  BarChart2, Settings, LogOut, Wrench, Menu, X, UserCircle, Landmark,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const NAV = [
  { href: '/billing/checkout', label: 'Checkout', icon: ShoppingCart, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
  { href: '/billing/invoices', label: 'Invoices', icon: FileText, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
  { href: '/accounts', label: 'Accounts', icon: Landmark, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
  { href: '/customers', label: 'Customers', icon: UserCircle, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
  { href: '/inventory', label: 'Inventory', icon: Package, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
  { href: '/audit', label: 'Audit Logs', icon: BarChart2, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  const visibleNav = NAV.filter((n) => !user || n.roles.includes(user.role));

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {visibleNav.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-red-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Mobile overlay ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col no-print
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0 lg:w-56 lg:flex lg:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-red-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">RE Parts</p>
              <p className="text-xs text-gray-400 truncate">{user?.store?.name}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks onClick={() => setSidebarOpen(false)} />
        </nav>

        <div className="p-3 border-t border-gray-700">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-300 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={async () => { await logout(); router.replace('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400
                       hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-gray-900 text-white flex items-center gap-3 px-4 py-3 shrink-0 no-print">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-red-400" />
            <span className="font-bold text-sm">RE Parts</span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
