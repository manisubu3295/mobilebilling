'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Mail } from 'lucide-react';
import adminApi, { ADMIN_TOKEN_KEY } from '@/lib/admin-api';
import { AdminHeader } from '@/components/admin/AdminHeader';

interface SettingsForm {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  adminNotifyEmail: string;
}

const EMPTY: SettingsForm = {
  smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '', adminNotifyEmail: '',
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [passSet, setPassSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/platform-admin/settings');
      setForm({
        smtpHost: data.smtpHost || '',
        smtpPort: String(data.smtpPort || 587),
        smtpUser: data.smtpUser || '',
        smtpPass: '',
        smtpFrom: data.smtpFrom || '',
        adminNotifyEmail: data.adminNotifyEmail || '',
      });
      setPassSet(!!data.smtpPassSet);
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

  const f = (k: keyof SettingsForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.patch('/platform-admin/settings', {
        smtpHost: form.smtpHost || undefined,
        smtpPort: form.smtpPort ? Number(form.smtpPort) : undefined,
        smtpUser: form.smtpUser || undefined,
        smtpPass: form.smtpPass || undefined,
        smtpFrom: form.smtpFrom || undefined,
        adminNotifyEmail: form.adminNotifyEmail || undefined,
      });
      setPassSet(!!data.smtpPassSet);
      setForm((p) => ({ ...p, smtpPass: '' }));
      setMessage('Settings saved.');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Platform Settings" subtitle="Email delivery configuration" />

      <div className="p-4 sm:p-6 max-w-xl">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : (
          <div className="bg-white rounded-xl border p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-700" />
              <h2 className="font-semibold text-gray-900">SMTP Configuration</h2>
            </div>
            <p className="text-xs text-gray-500 -mt-3">
              Used to notify you of password-reset requests and to email customers their new
              password when you resolve one. Until a host is set, these are logged instead of sent.
            </p>

            {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">{message}</p>}
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input value={form.smtpHost} onChange={f('smtpHost')} placeholder="smtp.gmail.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input type="number" value={form.smtpPort} onChange={f('smtpPort')} placeholder="587"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input value={form.smtpUser} onChange={f('smtpUser')} placeholder="you@example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {passSet && <span className="text-gray-400 font-normal">(already set — leave blank to keep it)</span>}
                </label>
                <input type="password" value={form.smtpPass} onChange={f('smtpPass')}
                  placeholder={passSet ? '••••••••' : ''}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
                <input value={form.smtpFrom} onChange={f('smtpFrom')} placeholder="Aadhirai Billing <no-reply@example.com>"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notify Email</label>
                <input type="email" value={form.adminNotifyEmail} onChange={f('adminNotifyEmail')} placeholder="you@example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                <p className="text-xs text-gray-400 mt-1">Where password-reset requests are sent.</p>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
