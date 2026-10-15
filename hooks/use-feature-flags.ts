'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_FLAGS, resolveFlags, type FeatureFlag } from '@/lib/feature-flags';

export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'platform_settings', 'feature_flags'),
      (snap) => setFlags(resolveFlags(snap.data())),
      () => setFlags(DEFAULT_FLAGS),
    );
    return () => unsub();
  }, []);

  return flags;
}
