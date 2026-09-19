'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleSave = async () => {
    setError('');
    if (!currentPassword) { setError('Enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
      // Changing the password invalidates this session's refresh token too —
      // sign out locally and send them back to log in with the new one.
      setTimeout(async () => {
        await logout().catch(() => {});
        router.replace('/login');
      }, 1800);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-700" />
          </div>
          <p className="font-semibold text-gray-900">Password changed</p>
          <p className="text-sm text-gray-500">Signing you out — please log in again with your new password.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-2 p-6 border-b">
          <KeyRound className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">Change Password</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
