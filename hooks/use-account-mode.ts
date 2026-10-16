'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  activeMode,
  canBecomeInstructor,
  readActiveMode,
  switchableModes,
  writeActiveMode,
  type AccountMode,
} from '@/lib/account-modes';
import type { Role } from '@/lib/roles';

/** The open dashboard. It is remembered in this browser and is not a permission. */
export function useAccountMode() {
  const profile = useAuthSTORE(state => state.profile);
  const [stored, setStored] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(readActiveMode());
    setReady(true);
  }, []);

  const modes = switchableModes(profile);
  // Stay on the learner shell until the remembered mode has been read.
  // Otherwise a teacher would flash their class list inside Learning.
  const mode = ready ? activeMode(profile, stored) : null;
  const activeRole: Role = mode ?? (ready ? (profile?.role ?? 'student') : 'student');

  const setMode = (next: AccountMode) => {
    const previous = mode;
    writeActiveMode(next);
    setStored(next);
    if (previous && previous !== next) {
      void import('@/lib/audit/report').then((mod) => mod.reportActivity({
        action: 'role.switch',
        targetType: 'mode',
        targetId: next,
        before: { mode: previous },
        after: { mode: next },
      }));
    }
  };

  return {
    ready,
    mode,
    modes,
    activeRole,
    setMode,
    canBecome: canBecomeInstructor(profile),
  };
}
