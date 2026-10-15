'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getMaterial, getPrep, updatePrep } from '@/lib/study/db';
import type { ExamPrep } from '@/lib/study/types';

/** Load one exam prep, keep it in sync locally, and fetch its material on demand. */
export function useExamPrep(id: string) {
  const { user } = useAuthSTORE();
  const uid = user?.uid;
  const [prep, setPrep] = useState<ExamPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const material = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      const p = await getPrep(uid, id);
      setPrep(p);
      setMissing(!p);
    } catch { setMissing(true); }
    finally { setLoading(false); }
  }, [uid, id]);

  useEffect(() => { reload(); }, [reload]);

  /** Apply a patch locally at once and persist it. */
  const patch = useCallback(async (p: Partial<ExamPrep>) => {
    setPrep(prev => (prev ? { ...prev, ...p } : prev));
    if (uid) await updatePrep(uid, id, p);
  }, [uid, id]);

  /** Merge a patch that was already persisted (e.g. by completeItem). */
  const merge = useCallback((p: Partial<ExamPrep>) => setPrep(prev => (prev ? { ...prev, ...p } : prev)), []);

  const loadMaterial = useCallback(async () => {
    if (material.current !== null) return material.current;
    if (!uid) return '';
    material.current = await getMaterial(uid, id).catch(() => '');
    return material.current;
  }, [uid, id]);

  return { prep, loading, missing, uid, reload, patch, merge, loadMaterial };
}
