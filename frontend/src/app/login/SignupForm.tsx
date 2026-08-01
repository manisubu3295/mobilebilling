'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth.store';

const schema = z
  .object({
    businessName: z.string().min(2, 'Business name is required'),
    ownerName: z.string().min(2, 'Your name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().regex(/^[0-9+][0-9+\-\s]{7,14}$/, 'Enter a valid phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof schema>;

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 ' +
  'text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent';

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthStore();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: SignupFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      const { confirmPassword, ...input } = values;
      await signup(input);
      onSuccess();
      router.push('/billing/checkout');
    } catch (err: any) {
      setServerError(
        err.response?.data?.message ||
          (err.request ? 'Cannot reach server. Check your connection.' : 'Could not create account'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-900 rounded-2xl p-6 space-y-4">
      {serverError && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
          {serverError}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Business Name</label>
        <input {...register('businessName')} className={inputClass} placeholder="e.g. Sri Balaji Traders" />
        {errors.businessName && <p className="text-red-400 text-xs mt-1">{errors.businessName.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Your Name</label>
        <input {...register('ownerName')} className={inputClass} placeholder="Owner / Admin name" />
        {errors.ownerName && <p className="text-red-400 text-xs mt-1">{errors.ownerName.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Email</label>
        <input {...register('email')} type="email" autoComplete="email" className={inputClass} />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Mobile Number</label>
        <input {...register('phone')} type="tel" autoComplete="tel" className={inputClass} />
        {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Password</label>
        <input {...register('password')} type="password" autoComplete="new-password" className={inputClass} />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
        <input
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
        {errors.confirmPassword && (
          <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-red-700 text-white rounded-lg font-semibold text-sm
                   hover:bg-red-800 disabled:opacity-50 transition-colors mt-2"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}
