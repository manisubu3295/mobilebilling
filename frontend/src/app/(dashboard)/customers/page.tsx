'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Users, Plus, Phone, ChevronRight, X, Pencil, UserCheck, UserX } from 'lucide-react';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  gstin: string | null;
  isActive: boolean;
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
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search: q || undefined, includeInactive: true } });
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

  const handleToggle = async (id: string) => {
    await api.patch(`/customers/${id}/toggle`);
    load(search);
    if (selected?.id === id) setSelected((s) => (s ? { ...s, isActive: !s.isActive } : s));
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
                <div key={c.id} className={`bg-white rounded-xl border p-4 ${!c.isActive ? 'opacity-60' : ''}`}>
                  <button onClick={() => handleView(c.id)} className="w-full text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          {!c.isActive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactive</span>}
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3.5 w-3.5" /> {c.phone}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
                    </div>
                  </button>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => handleToggle(c.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                        c.isActive ? 'hover:bg-red-50 text-gray-600 hover:text-red-600' : 'hover:bg-green-50 text-gray-600 hover:text-green-600'
                      }`}
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${!c.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 cursor-pointer" onClick={() => handleView(c.id)}>{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 cursor-pointer" onClick={() => handleView(c.id)}>{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500 cursor-pointer" onClick={() => handleView(c.id)}>{c.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${c.isActive ? 'text-green-600' : 'text-red-500'}`}>
                          {c.isActive ? <><UserCheck className="h-3.5 w-3.5" /> Active</> : <><UserX className="h-3.5 w-3.5" /> Inactive</>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(c.id)}
                          className={`p-1.5 rounded text-xs font-medium transition-colors ${
                            c.isActive ? 'hover:bg-red-50 text-gray-400 hover:text-red-600' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                          }`}
                          title={c.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {c.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
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
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  {!selected.isActive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactive</span>}
                </div>
                <p className="text-sm text-gray-500">{selected.phone}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(selected)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleToggle(selected.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  {selected.isActive ? <><UserX className="h-3.5 w-3.5" /> Deactivate</> : <><UserCheck className="h-3.5 w-3.5" /> Activate</>}
                </button>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-1">&times;</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selected.email}</span></div>}
                {selected.address && <div><span className="text-gray-500">Address:</span> <span className="font-medium">{selected.address}</span></div>}
                {selected.gstin && <div><span className="text-gray-500">GSTIN:</span> <span className="font-medium font-mono">{selected.gstin}</span></div>}
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

      {showAdd && <CustomerFormModal onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); load(search); }} />}
      {editing && (
        <CustomerFormModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            setSelected(null);
            load(search);
          }}
        />
      )}
    </div>
  );
}

function CustomerFormModal({ customer, onClose, onSave }: { customer?: Customer; onClose: () => void; onSave: () => void }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    gstin: customer?.gstin ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.phone) { setError('Name and phone are required.'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/customers/${customer!.id}`, form);
      } else {
        await api.post('/customers', form);
      }
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} customer`);
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
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {[
            { label: 'Full Name *', key: 'name', placeholder: '' },
            { label: 'Phone *', key: 'phone', placeholder: '9876543210' },
            { label: 'Email', key: 'email', placeholder: '' },
            { label: 'Address', key: 'address', placeholder: '' },
            { label: 'GSTIN', key: 'gstin', placeholder: '33XXXXX1234X1ZX' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={key === 'gstin' ? (e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() })) : f(key)}
                placeholder={placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
