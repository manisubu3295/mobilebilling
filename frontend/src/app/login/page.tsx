'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Wrench } from 'lucide-react';

const DEMO_CREDS = [
  { label: 'Admin', email: 'admin@aadhirai.com', password: 'Admin@1234', role: 'Super Admin' },
  { label: 'Clerk', email: 'clerk@aadhirai.com', password: 'Clerk@1234', role: 'Billing Clerk' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/billing/checkout');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillCreds = (cred: typeof DEMO_CREDS[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-700 rounded-2xl mb-4">
            <Wrench className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Aadhirai Royal Enfield</h1>
          <p className="text-gray-400 text-sm mt-1">Spare Parts Billing — Sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-red-700 text-white rounded-lg font-semibold text-sm
                       hover:bg-red-800 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Demo Accounts</p>
          {DEMO_CREDS.map((c) => (
            <button
              key={c.email}
              onClick={() => fillCreds(c)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800 hover:bg-gray-700
                         rounded-lg transition-colors text-left group"
            >
              <div>
                <p className="text-sm font-semibold text-white">{c.label}</p>
                <p className="text-xs text-gray-400">{c.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 group-hover:text-gray-300">{c.role}</p>
                <p className="text-xs text-gray-600 font-mono group-hover:text-gray-400">{c.password}</p>
              </div>
            </button>
          ))}
          <p className="text-xs text-gray-600 text-center pt-1">Click a row to fill credentials</p>
        </div>
      </div>
    </div>
  );
}
