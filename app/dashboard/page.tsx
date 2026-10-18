'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { landingPath, MODE_STORAGE_KEY } from '@/lib/account-modes';

/** /dashboard opens the home for the signed-in role. */
export default function DashboardIndex() {
  const router = useRouter();
  const { user, profile, loading } = useAuthSTORE();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    router.replace(landingPath(profile, stored));
  }, [loading, user, profile, router]);

  return <p className="p-8 text-sm text-[#1E6A83]">Opening your dashboard.</p>;
}
