'use client';

import { useEffect } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { hasAccountRole } from '@/lib/account-modes';

/** Backfill PS-XXXX-XXXX the first time a student profile loads without one. */
export function useEnsureStudentNumber() {
  const user = useAuthSTORE((state) => state.user);
  const profile = useAuthSTORE((state) => state.profile);
  const student = hasAccountRole(profile, 'student');
  const existing = profile?.studentNumber ?? '';

  useEffect(() => {
    if (!user || !student || existing) return;
    let cancel = false;
    authedFetch('/api/account/student-number', { method: 'POST', body: '{}' })
      .then((data) => {
        const studentNumber = typeof data.studentNumber === 'string' ? data.studentNumber : '';
        if (cancel || !studentNumber) return;
        useAuthSTORE.setState((state) => ({
          profile: state.profile ? { ...state.profile, studentNumber } : state.profile,
        }));
      })
      .catch(() => undefined);
    return () => { cancel = true; };
  }, [user, student, existing]);
}
