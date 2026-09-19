'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { roleLandingPage } from '@/lib/role-landing';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    router.replace(roleLandingPage(user?.role));
  }, [hasHydrated, isAuthenticated, user?.role, router]);

  return null;
}
