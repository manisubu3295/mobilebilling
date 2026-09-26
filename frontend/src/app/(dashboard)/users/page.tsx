'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, UserCheck, UserX, Shield, Pencil, KeyRound, Copy, Check } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  STORE_MANAGER: 'bg-blue-100 text-blue-700',
  BILLING_CLERK: 'bg-green-100 text-green-700',
  INVENTORY_MANAGER: 'bg-orange-100 text-orange-700',
  SERVICE_STAFF: 'bg-teal-100 text-teal-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const { user: me } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    if (id === me?.id) { alert("You can't deactivate your own account."); return; }
    try {
      await api.patch(`/users/${id}/toggle`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} users in this store</p>
        </div>
        <button aria-label="Add User"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add User</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {users.map((u) => (
                <div key={u.id} className={`bg-white rounded-xl border p-4 space-y-2 ${!u.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{u.name} {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1 text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                      {u.isActive ? <><UserCheck className="h-3.5 w-3.5" /> Active</> : <><UserX className="h-3.5 w-3.5" /> Inactive</>}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingUser(u)} className="px-2 py-1 rounded-lg text-xs font-medium border text-gray-600 hover:bg-gray-50" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setResettingUser(u)} className="px-2 py-1 rounded-lg text-xs font-medium border text-gray-600 hover:bg-gray-50" title="Reset Password">
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(u.id)}
                        disabled={u.id === me?.id}
                        className={`px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-30 border ${
                          u.isActive ? 'hover:bg-red-50 text-gray-600 hover:text-red-600' : 'hover:bg-green-50 text-gray-600 hover:text-green-600'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                    <th className="px-4 py-3 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold text-xs">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{u.name}</span>
                          {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                          {u.isActive ? <><UserCheck className="h-3.5 w-3.5" /> Active</> : <><UserX className="h-3.5 w-3.5" /> Inactive</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 rounded text-xs font-medium transition-colors text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setResettingUser(u)}
                            className="p-1.5 rounded text-xs font-medium transition-colors text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(u.id)}
                            disabled={u.id === me?.id}
                            className={`p-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30 ${
                              u.isActive
                                ? 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                                : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                            }`}
                            title={u.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSave={load} />}
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={load} />
      )}
      {resettingUser && (
        <ResetPasswordModal user={resettingUser} onClose={() => setResettingUser(null)} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { account } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'BILLING_CLERK' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await api.post('/users', form);
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 p-6 border-b">
          <Shield className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">Add User</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {[
            { label: 'Full Name *', key: 'name', type: 'text' },
            { label: 'Email *', key: 'email', type: 'email' },
            { label: 'Phone', key: 'phone', type: 'tel' },
            { label: 'Password * (min 8 chars)', key: 'password', type: 'password' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={f(key)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
            <select value={form.role} onChange={f('role')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="BILLING_CLERK">Billing Clerk</option>
              <option value="INVENTORY_MANAGER">Inventory Manager</option>
              {account?.serviceModuleEnabled && <option value="SERVICE_STAFF">Service Staff</option>}
              <option value="STORE_MANAGER">Store Manager</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: () => void }) {
  const { account } = useAuthStore();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', role: user.role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.name) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, form);
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 p-6 border-b">
          <Pencil className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">Edit User</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={f('name')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Email can&apos;t be changed here — contact support if it&apos;s wrong.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={f('phone')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
            <select value={form.role} onChange={f('role')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="BILLING_CLERK">Billing Clerk</option>
              <option value="INVENTORY_MANAGER">Inventory Manager</option>
              {account?.serviceModuleEnabled && <option value="SERVICE_STAFF">Service Staff</option>}
              <option value="STORE_MANAGER">Store Manager</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setError('');
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${user.id}/reset-password`);
      setTempPassword(data.tempPassword);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can still select the text manually
    }
  };

  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="text-center space-y-1">
            <p className="font-semibold text-gray-900">Temporary password for {user.name}</p>
            <p className="text-xs text-gray-500">Share this with them now — it won&apos;t be shown again.</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
            <code className="flex-1 text-sm font-mono text-gray-900 break-all">{tempPassword}</code>
            <button onClick={handleCopy} className="shrink-0 text-gray-500 hover:text-gray-800" title="Copy">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={onClose} className="w-full py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">Reset Password</h2>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
        <p className="text-sm text-gray-600">
          This generates a new temporary password for <span className="font-medium text-gray-900">{user.name}</span> and signs them out everywhere.
          They should change it after logging in.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleReset} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
