'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ADMIN_TOKEN_KEY } from '@/lib/admin-api';

const TABS = [
  { href: '/admin/accounts', label: 'Accounts' },
  { href: '/admin/requests', label: 'Reset Requests' },
];

export function AdminHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    router.push('/admin/login');
  };

  return (
    <div className="bg-gray-900 px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
      <div className="flex gap-4 mt-4 border-b border-gray-800">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              pathname === t.href
                ? 'border-red-600 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
