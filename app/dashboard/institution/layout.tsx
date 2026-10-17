'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInstitution } from '@/lib/db';
import { institutionAdminDestination } from '@/lib/institution-journey';

/** Pending academies stay on the status screen. First-time admins open the checklist. */
export default function InstitutionDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuthSTORE();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || profile?.role !== 'institution_admin' || !profile.institutionId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void getInstitution(profile.institutionId)
      .then((academy) => {
        if (cancelled) return;
        const destination = institutionAdminDestination({
          status: academy?.status,
          setupComplete: academy?.setupComplete,
        });
        if (destination === '/institutions/pending') {
          router.replace(destination);
          return;
        }
        if (destination === '/dashboard/institution/onboarding' && pathname === '/dashboard/institution') {
          router.replace(destination);
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [loading, user, profile, pathname, router]);

  if (!ready) return <p className="p-8 text-sm text-muted-foreground">Loading the academy…</p>;
  return children;
}
