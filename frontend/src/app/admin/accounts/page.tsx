'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import adminApi, { ADMIN_TOKEN_KEY } from '@/lib/admin-api';
import { AdminHeader } from '@/components/admin/AdminHeader';

interface PlatformAccount {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  tenantDbName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/platform-admin/accounts');
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(ADMIN_TOKEN_KEY)) {
      router.replace('/admin/login');
      return;
    }
    load();
  }, [load, router]);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.businessName.toLowerCase().includes(q) ||
      a.ownerName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Signed-Up Businesses" subtitle={`${accounts.length} total accounts`} />

      <div className="p-4 sm:p-6">
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business, owner, email, phone…"
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            {accounts.length === 0 ? 'No businesses have signed up yet.' : 'No accounts match your search.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.businessName}</td>
                    <td className="px-4 py-3 text-gray-700">{a.ownerName}</td>
                    <td className="px-4 py-3 text-gray-700">{a.email}</td>
                    <td className="px-4 py-3 text-gray-700">{a.phone}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
