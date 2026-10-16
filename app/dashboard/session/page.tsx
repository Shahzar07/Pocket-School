'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { safeDashboardNext } from '@/lib/dashboard-access';
import { Suspense } from 'react';

function SessionBridge() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuthSTORE();
  const next = safeDashboardNext(params.get('next'));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(next.startsWith('/dashboard/admin') ? '/admin/login' : '/login');
      return;
    }
    let cancelled = false;
    user.getIdToken().then(async (token) => {
      if (cancelled) return;
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!cancelled) window.location.assign(next);
    }).catch(() => {
      if (!cancelled) window.location.assign(next);
    });
    return () => { cancelled = true; };
  }, [user, loading, next, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function DashboardSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SessionBridge />
    </Suspense>
  );
}
