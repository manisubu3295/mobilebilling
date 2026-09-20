'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingCart, Package, Users, FileText,
  BarChart2, Settings, LogOut, Store, Menu, X, UserCircle, Landmark, BookOpen, Smartphone,
  ClipboardList, Wrench, Bell, AlertTriangle, TrendingUp, ClipboardCheck, LayoutDashboard, KeyRound, CalendarClock,
  Globe, UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useBillingStore } from '@/store/billing.store';
import api from '@/lib/api';
import { ChangePasswordModal } from '@/components/account/ChangePasswordModal';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  serviceModule?: true;
  websiteModule?: true;
}

// Grouped so the sidebar reads as sections rather than one long flat list —
// a `label` of null renders no header (the everyday billing/catalog items),
// while Service and Admin get their own labeled, visually separated groups.
const NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      { href: '/billing/checkout', label: 'Checkout', icon: ShoppingCart, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
      { href: '/billing/invoices', label: 'Invoices', icon: FileText, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
      { href: '/billing/quotations', label: 'Quotations', icon: ClipboardList, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'], serviceModule: true },
      { href: '/accounts', label: 'Accounts', icon: Landmark, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      { href: '/customers', label: 'Customers', icon: UserCircle, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'BILLING_CLERK'] },
      { href: '/inventory', label: 'Inventory', icon: Package, roles: ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER'] },
    ],
  },
  {
    label: 'Service',
    items: [
      { href: '/service', label: 'Service Jobs', icon: Wrench, roles: ['SUPER_ADMIN', 'STORE_MANAGER'], serviceModule: true },
      { href: '/service/my-jobs', label: 'My Service Jobs', icon: ClipboardCheck, roles: ['SERVICE_STAFF'], serviceModule: true },
      { href: '/service/next-service', label: 'Next Service', icon: CalendarClock, roles: ['SUPER_ADMIN', 'STORE_MANAGER'], serviceModule: true },
      { href: '/service/reports', label: 'Service Reports', icon: TrendingUp, roles: ['SUPER_ADMIN', 'STORE_MANAGER'], serviceModule: true },
    ],
  },
  {
    label: 'Website',
    items: [
      { href: '/website/leads', label: 'Leads', icon: UserPlus, roles: ['SUPER_ADMIN', 'STORE_MANAGER'], websiteModule: true },
      { href: '/website/products', label: 'Products', icon: Globe, roles: ['SUPER_ADMIN', 'STORE_MANAGER'], websiteModule: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/users', label: 'Users', icon: Users, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      { href: '/audit', label: 'Audit Logs', icon: BarChart2, roles: ['SUPER_ADMIN', 'STORE_MANAGER'] },
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN'] },
    ],
  },
];

// Days before licenseExpiresAt to start showing the warning banner.
const LICENSE_WARNING_WINDOW_DAYS = 30;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, account, logout, isAuthenticated, hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    // Wait for the persisted store to rehydrate from localStorage first —
    // isAuthenticated defaults to false on first render, so redirecting
    // before hydration finishes bounces an already-logged-in user on
    // every hard reload / deep link.
    if (hasHydrated && !isAuthenticated) router.replace('/login');
  }, [hasHydrated, isAuthenticated, router]);

  const isAdminRole = user?.role === 'SUPER_ADMIN' || user?.role === 'STORE_MANAGER';

  // Notification badge: nearing/overdue AMC visits + unresolved real
  // notifications (service-completion alerts), summed. Computed live on the
  // backend rather than pushed, so a periodic poll is enough for v1.
  useEffect(() => {
    if (!account?.serviceModuleEnabled || !isAdminRole) return;
    const load = () => {
      Promise.all([
        api.get('/warranty/nearing-due'),
        api.get('/notifications/unread-count'),
      ]).then(([due, unread]) => {
        setDueCount((due.data.overdueCount ?? 0) + (due.data.upcomingCount ?? 0) + (unread.data ?? 0));
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [account?.serviceModuleEnabled, isAdminRole]);

  // Website Leads badge: unread NEW_LEAD notifications, polled separately
  // from the service due-count since it's gated by websiteModule, not
  // serviceModule. Cleared by the Leads page itself marking them read.
  useEffect(() => {
    if (!account?.websiteEnabled || !isAdminRole) return;
    const load = () => {
      api.get('/notifications/unread-count', { params: { type: 'NEW_LEAD' } })
        .then((res) => setNewLeadsCount(res.data ?? 0))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [account?.websiteEnabled, isAdminRole]);

  const licenseDaysLeft = account?.licenseExpiresAt
    ? Math.ceil((new Date(account.licenseExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showLicenseBanner = licenseDaysLeft !== null && licenseDaysLeft <= LICENSE_WARNING_WINDOW_DAYS && !bannerDismissed;

  // The billing cart persists to a single fixed localStorage entry — on a
  // shared browser, reconcile it against whoever is actually signed in now
  // so one store's in-progress checkout can never leak into another
  // store's session (see BillingState.resetForStore).
  useEffect(() => {
    if (user?.store?.id) useBillingStore.getState().resetForStore(user.store.id);
  }, [user?.store?.id]);

  // Native <details> menus (help / account) don't close on an outside
  // click by default — do it manually so they behave like a normal dropdown.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      document.querySelectorAll('details[data-menu][open]').forEach((el) => {
        if (!el.contains(e.target as Node)) el.removeAttribute('open');
      });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (n) =>
          (!user || n.roles.includes(user.role)) &&
          (!n.serviceModule || account?.serviceModuleEnabled) &&
          (!n.websiteModule || account?.websiteEnabled),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {visibleSections.map((section, i) => (
        <div key={section.label ?? 'main'} className={i > 0 ? 'mt-4 pt-4 border-t border-gray-800' : ''}>
          {section.label && (
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              {section.label}
            </p>
          )}
          <div className="space-y-1">
            {section.items.map((item) => {
              // Exact match only — every nav item is a flat top-level route,
              // so startsWith() previously made e.g. "Service Jobs" (/service)
              // light up while viewing "Service Reports" (/service/reports).
              const active = pathname === item.href;
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
                  {item.href === '/website/leads' && newLeadsCount > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-[10px] leading-none rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                      {newLeadsCount > 99 ? '99+' : newLeadsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
          <div className="flex items-center gap-2 min-w-0">
            <Store className="h-6 w-6 text-red-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">Aadhirai Billing</p>
              <p className="text-xs text-gray-400 truncate">{user?.store?.name}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1.5 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLinks onClick={() => setSidebarOpen(false)} />
        </nav>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — visible at every width. On mobile it also carries the
            hamburger + store name (the sidebar is off-canvas there); on
            desktop the sidebar already shows those, so only the right-hand
            utility cluster (notifications / help / account) is visible. */}
        <header className="bg-gray-900 text-white flex items-center gap-3 px-4 py-3 shrink-0 no-print">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <Store className="h-5 w-5 text-red-400" />
            <span className="font-bold text-sm">Aadhirai Billing</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 shrink-0">
            {account?.serviceModuleEnabled && isAdminRole && (
              <Link
                href="/service/notifications"
                className="relative text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800"
                title="Service notifications"
              >
                <Bell className="h-5 w-5" />
                {dueCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[10px] leading-none rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </Link>
            )}

            {/* Help — collapsed behind one icon rather than two permanent
                sidebar rows, since neither is a day-to-day billing action. */}
            <details className="relative" data-menu>
              <summary className="list-none cursor-pointer text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800" title="Help">
                <BookOpen className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                <a
                  href="/docs/user-guide.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <BookOpen className="h-4 w-4" /> User Guide
                </a>
                <a
                  href="/docs/user-guide.html#mobile-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <Smartphone className="h-4 w-4" /> Get Android App
                </a>
              </div>
            </details>

            {/* Account — name/role + sign out, top-right corner. */}
            <details className="relative" data-menu>
              <summary className="list-none cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800">
                <UserCircle className="h-6 w-6" />
                <span className="text-sm font-medium hidden sm:inline max-w-[10rem] truncate">{user?.name}</span>
              </summary>
              <div className="absolute right-0 mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400">{user?.role?.replace(/_/g, ' ')}</p>
                </div>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <KeyRound className="h-4 w-4" /> Change Password
                </button>
                <button
                  onClick={async () => { await logout(); router.replace('/login'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </details>
          </div>
        </header>

        {showLicenseBanner && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs sm:text-sm text-amber-800 no-print">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {licenseDaysLeft! < 0
                ? `Your license expired ${Math.abs(licenseDaysLeft!)} day(s) ago. Contact Aadhirai Innovations to renew.`
                : `Your license expires in ${licenseDaysLeft} day(s). Contact Aadhirai Innovations to renew.`}
            </span>
            <button onClick={() => setBannerDismissed(true)} className="text-amber-600 hover:text-amber-900 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
