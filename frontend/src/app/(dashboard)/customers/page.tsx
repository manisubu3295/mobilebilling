'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Users, Plus, Phone, Car, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  customFields: Record<string, any> | null;
  createdAt: string;
  invoices?: { id: string; invoiceNumber: string; totalAmount: string; status: string; createdAt: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-600',
  RETURNED: 'bg-purple-100 text-purple-700',
  DRAFT: 'bg-gray-100 text-gray-600',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const { data } = await api.get(`/customers${params}`);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleView = async (id: string) => {
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/customers/${id}`);
      setSelected(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} records</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 shrink-0"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Customer</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Users className="h-10 w-10 opacity-40" />
            <p>{search ? 'No customers match your search' : 'No customers yet'}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleView(c.id)}
                  className="w-full bg-white rounded-xl border p-4 text-left hover:border-red-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                      </p>
                      {(c.customFields?.vehicle_no || c.customFields?.re_model) && (
                        <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                          <Car className="h-3.5 w-3.5" /> {c.customFields?.vehicle_no} {c.customFields?.re_model && `· ${c.customFields.re_model}`}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Model</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleView(c.id)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-600 text-xs">{c.customFields?.vehicle_no || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.customFields?.re_model || '—'}</td>
                      <td className="px-4 py-3">
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Customer detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selected.email}</span></div>}
                {selected.customFields?.vehicle_no && <div><span className="text-gray-500">Vehicle No:</span> <span className="font-medium font-mono">{selected.customFields.vehicle_no}</span></div>}
                {selected.customFields?.re_model && <div><span className="text-gray-500">Model:</span> <span className="font-medium">{selected.customFields.re_model}</span></div>}
                <div><span className="text-gray-500">Since:</span> <span className="font-medium">{new Date(selected.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span></div>
              </div>
              {selected.invoices && selected.invoices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Purchase History</p>
                  <div className="space-y-2">
                    {selected.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-mono text-red-700 text-xs font-semibold">{inv.invoiceNumber}</p>
                          <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{parseFloat(inv.totalAmount).toLocaleString('en-IN')}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); load(search); }} />}
    </div>
  );
}

function AddCustomerModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicleNo: '', reModel: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.phone) { setError('Name and phone are required.'); return; }
    setSaving(true);
    try {
      const { vehicleNo, reModel, ...rest } = form;
      const customFields: Record<string, string> = {};
      if (vehicleNo) customFields.vehicle_no = vehicleNo;
      if (reModel) customFields.re_model = reModel;
      await api.post('/customers', { ...rest, customFields: Object.keys(customFields).length ? customFields : undefined });
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 p-6 border-b">
          <Users className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">Add Customer</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {[
            { label: 'Full Name *', key: 'name', placeholder: '' },
            { label: 'Phone *', key: 'phone', placeholder: '9876543210' },
            { label: 'Email', key: 'email', placeholder: '' },
            { label: 'Vehicle No. (optional)', key: 'vehicleNo', placeholder: 'TN01AB1234' },
            { label: 'Model (optional)', key: 'reModel', placeholder: 'e.g. Classic 350' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={f(key)}
                placeholder={placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
