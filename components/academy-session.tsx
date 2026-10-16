'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ApiError, authedFetch } from '@/lib/api-client';
import { getInstitution, type Institution } from '@/lib/db';
import { useAuthSTORE } from '@/hooks/use-auth';
import { useWhiteLabel } from '@/components/white-label-provider';

/** Applies an academy session timeout and IP allowlist after sign-in. */
export function AcademySession() {
  const { user, profile } = useAuthSTORE();
  const { institution: hosted } = useWhiteLabel();
  const [academy, setAcademy] = useState<Institution | null>(hosted);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (hosted) {
      setAcademy(hosted);
      return;
    }
    const institutionId = profile?.institutionId;
    if (!institutionId) {
      setAcademy(null);
      return;
    }
    let cancelled = false;
    getInstitution(institutionId)
      .then((found) => { if (!cancelled) setAcademy(found); })
      .catch(() => { if (!cancelled) setAcademy(null); });
    return () => { cancelled = true; };
  }, [hosted, profile?.institutionId]);

  useEffect(() => {
    const minutes = academy?.sessionTimeoutMinutes ?? 0;
    if (!user || minutes <= 0) return;
    let timer = window.setTimeout(() => { void signOut(auth); }, minutes * 60 * 1000);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void signOut(auth); }, minutes * 60 * 1000);
    };
    window.addEventListener('pointerdown', bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', bump);
    };
  }, [academy?.sessionTimeoutMinutes, user]);

  useEffect(() => {
    if (!user || !academy?.id) return;
    let cancelled = false;
    authedFetch('/api/institutions/access', {
      method: 'POST',
      body: JSON.stringify({ institutionId: academy.id }),
    })
      .then((data) => {
        if (!cancelled && data && typeof data === 'object' && data.allowed === false) setBlocked(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const missingSdk = error instanceof ApiError && (error.status === 503 || error.code === 'ADMIN_NOT_CONFIGURED');
        setBlocked(missingSdk);
      });
    return () => { cancelled = true; };
  }, [academy?.id, user]);

  if (!blocked) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="font-heading text-3xl">This network is outside the academy allowlist</h1>
        <p className="text-sm text-muted-foreground">Ask an academy administrator to add this address, then sign in again.</p>
        <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => void signOut(auth)}>Sign out</button>
      </div>
    </div>
  );
}
