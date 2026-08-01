'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Save, Store, QrCode, Upload, X, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: '', address: '', phone: '', gstNumber: '', staticQrUrl: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings/store').then(({ data }) => {
      setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        gstNumber: data.gstNumber || '',
        staticQrUrl: data.staticQrUrl || '',
      });
    }).catch(() => {
      if (user?.store) setForm((f) => ({ ...f, name: user.store.name || '' }));
    });
  }, [user]);

  const handleSave = async (fields?: Partial<typeof form>) => {
    setError(''); setSaving(true);
    const payload = { ...form, ...fields };
    try {
      await api.patch('/settings/store', {
        name: payload.name,
        address: payload.address,
        phone: payload.phone,
        gstNumber: payload.gstNumber,
        staticQrUrl: payload.staticQrUrl || undefined,
      });
      if (fields) setForm((f) => ({ ...f, ...fields }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 500 * 1024) { setError('Image must be under 500 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((f) => ({ ...f, staticQrUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const clearQr = () => {
    setForm((f) => ({ ...f, staticQrUrl: '' }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const isBase64Qr = form.staticQrUrl.startsWith('data:image/');

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Store configuration and integrations</p>
        </div>

        {/* Global messages */}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</p>}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">
            <CheckCircle className="h-4 w-4 shrink-0" /> Settings saved successfully
          </div>
        )}

        {/* Store Info */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-red-700" />
            <h2 className="font-semibold text-gray-900">Store Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Store Name *" value={form.name} onChange={f('name')} />
            <Field label="Phone" value={form.phone} onChange={f('phone')} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                rows={2}
                value={form.address}
                onChange={f('address')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <Field label="GSTIN" value={form.gstNumber} onChange={f('gstNumber')} placeholder="33XXXXX1234X1ZX" />
          </div>

          <button onClick={() => handleSave()} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Payment QR Settings */}
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-red-700" />
            <h2 className="font-semibold text-gray-900">Payment QR Configuration</h2>
          </div>

          {/* Static QR upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Static QR Image <span className="text-gray-400 font-normal">(fallback / walk-in)</span>
            </label>

            {form.staticQrUrl ? (
              /* Preview */
              <div className="flex items-start gap-4">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-2 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.staticQrUrl}
                    alt="Payment QR"
                    className="w-36 h-36 object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-gray-500">
                    {isBase64Qr ? 'Uploaded image (stored in DB)' : 'External URL'}
                  </p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Upload className="h-3.5 w-3.5" /> Replace Image
                  </button>
                  <button
                    onClick={clearQr}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" /> Remove QR
                  </button>
                </div>
              </div>
            ) : (
              /* Upload zone */
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors"
              >
                <Upload className="h-8 w-8 opacity-60" />
                <p className="text-sm font-medium">Click to upload QR image</p>
                <p className="text-xs text-gray-400">PNG or JPG · max 500 KB</p>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFileUpload}
            />

            {/* OR paste URL */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">— or paste an image URL —</label>
              <input
                type="url"
                value={isBase64Qr ? '' : form.staticQrUrl}
                onChange={(e) => setForm((f) => ({ ...f, staticQrUrl: e.target.value }))}
                placeholder="https://example.com/upi-qr.png"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <p className="text-xs text-gray-400 mt-1">
              This QR is shown on the payment screen and printed on receipts.
            </p>
          </div>

          <button onClick={() => handleSave()} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save QR Settings'}
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Your Account</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Name:</span> <span className="font-medium">{user?.name}</span></div>
            <div><span className="text-gray-500">Role:</span> <span className="font-medium">{user?.role?.replace(/_/g, ' ')}</span></div>
            <div><span className="text-gray-500">Store:</span> <span className="font-medium">{user?.store?.name}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }: {
  label: string; value: string; onChange: any; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  );
}
