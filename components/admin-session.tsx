'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { reportActivity } from '@/lib/audit/report';
import { useAuthSTORE } from '@/hooks/use-auth';
import { sessionExpired } from '@/lib/admin-console';
import {
  ADMIN_ACTIVITY_KEY,
  clearViewAs,
  readViewAs,
  touchAdminActivity,
  type ViewAsTarget,
} from '@/lib/view-as';

export { clearViewAs, readViewAs, writeViewAs, touchAdminActivity, type ViewAsTarget } from '@/lib/view-as';

export function useViewAs(): ViewAsTarget | null {
  const [target, setTarget] = useState<ViewAsTarget | null>(null);
  useEffect(() => {
    const sync = () => setTarget(readViewAs());
    sync();
    window.addEventListener('poket-view-as', sync);
    return () => window.removeEventListener('poket-view-as', sync);
  }, []);
  return target;
}

export function useAdminIdle(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    touchAdminActivity();
    const touch = () => touchAdminActivity();
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    const timer = window.setInterval(() => {
      const last = Number(sessionStorage.getItem(ADMIN_ACTIVITY_KEY) || Date.now());
      if (sessionExpired(last, Date.now())) {
        clearViewAs();
        const uid = useAuthSTORE.getState().user?.uid || '';
        void reportActivity({ action: 'auth.logout', targetType: 'session', targetId: uid }).finally(() => {
          void signOut(auth).finally(() => {
            useAuthSTORE.getState().setUser(null);
            router.push('/admin/login?reason=timeout');
          });
        });
      }
    }, 15000);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.clearInterval(timer);
    };
  }, [enabled, router]);
}

export function AdminViewAsBanner() {
  const target = useViewAs();
  if (!target) return null;
  return (
    <div className="border-b border-[var(--ps-cyan-border)] bg-[var(--ps-cyan)] text-[var(--ps-cyan-ink)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm shrink-0">
      <p>
        <strong>Viewing as {target.name || 'this user'}</strong>
        {target.email ? ` (${target.email})` : ''}. This session is read-only.
      </p>
      <button type="button" onClick={clearViewAs} className="font-bold underline">
        Exit view-as
      </button>
    </div>
  );
}
