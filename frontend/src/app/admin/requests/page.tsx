'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import adminApi, { ADMIN_TOKEN_KEY } from '@/lib/admin-api';
import { AdminHeader } from '@/components/admin/AdminHeader';

interface ResetRequest {
  id: string;
  requestedEmail: string;
  createdAt: string;
  account: {
    businessName: string;
    ownerName: string;
    phone: string;
  };
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/platform-admin/requests');
      setRequests(data);
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

  const handleResolve = async (id: string, email: string) => {
    if (!confirm(`Reset the password for ${email} and email them the new one?`)) return;
    setResolvingId(id);
    try {
      await adminApi.post(`/platform-admin/requests/${id}/resolve`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to resolve request');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Password Reset Requests" subtitle={`${requests.length} pending`} />

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="text-center text-gray-500 py-16">No pending reset requests.</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-gray-900">{r.account.businessName}</td>
                    <td className="px-4 py-3 text-gray-700">{r.account.ownerName}</td>
                    <td className="px-4 py-3 text-gray-700">{r.requestedEmail}</td>
                    <td className="px-4 py-3 text-gray-700">{r.account.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleResolve(r.id, r.requestedEmail)}
                        disabled={resolvingId === r.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-medium hover:bg-red-800 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {resolvingId === r.id ? 'Resetting…' : 'Reset & Send'}
                      </button>
                    </td>
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
