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
    writeActiveMode(next);
    setStored(next);
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
