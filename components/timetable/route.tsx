'use client';

import { Suspense } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import type { TimetableActor } from '@/lib/timetable/access';
import { TimetableDesk } from './desk';

type Surface = 'institution' | 'personal' | 'teacher' | 'student' | 'parent';

export function TimetableRoute({ surface }: { surface: Surface }) {
  const { user, profile, loading } = useAuthSTORE();
  if (loading) return null;
  const actor: TimetableActor = {
    uid: user?.uid,
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
    institutionId: profile?.institutionId,
    childIds: profile?.childIds,
    plan: profile?.role === 'admin' ? 'enterprise' : undefined,
  };
  return (
    <Suspense fallback={null}>
      <TimetableDesk surface={surface} actor={actor} />
    </Suspense>
  );
}
