'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (err.request ? 'Cannot reach server. Check your connection.' : 'Something went wrong'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-700 rounded-2xl mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
          <p className="text-gray-400 text-sm mt-1">
            We&apos;ll notify our admin team to reset it and email you a new password.
          </p>
        </div>

        {sent ? (
          <div className="bg-gray-900 rounded-2xl p-6 space-y-4 text-center">
            <p className="text-sm text-gray-300">
              If an account exists for <span className="text-white">{email}</span>, a reset request has
              been sent to the admin. You&apos;ll receive a new password by email shortly.
            </p>
            <Link href="/login" className="inline-block text-sm text-red-400 hover:text-red-300">
              Back to Sign In
            </Link>
          </div>
        ) : (
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
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? 'Sending…' : 'Send Request'}
            </button>
            <Link href="/login" className="block text-center text-sm text-gray-400 hover:text-gray-200">
              Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
