'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { authedFetch } from '@/lib/api-client';
import { auth, db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { ADMIN_TASKS, parseAdminTask, presentTask, sortTasks, type AdminPushPrefs, type AdminTask } from '@/lib/admin/tasks';

function asTasks(value: unknown): AdminTask[] {
  return Array.isArray(value) ? value as AdminTask[] : [];
}

function asPrefs(value: unknown): AdminPushPrefs | null {
  if (!value || typeof value !== 'object') return null;
  return value as AdminPushPrefs;
}

export function useAdminTasks() {
  const profile = useAuthSTORE(state => state.profile);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [prefs, setPrefs] = useState<AdminPushPrefs | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const live = useRef(false);
  const known = useRef<Set<string> | null>(null);

  const applyTasks = useCallback((next: AdminTask[]) => {
    const sorted = sortTasks(next, Date.now());
    if (known.current) {
      const fresh = sorted.filter(task => !known.current?.has(task.id)).slice(0, 3);
      for (const task of fresh) {
        toast(task.title, { description: task.summary || 'An admin task is waiting.' });
      }
    }
    known.current = new Set(sorted.map(task => task.id));
    setTasks(sorted);
  }, []);

  const load = useCallback(() => {
    const timer = window.setTimeout(() => setLoading(false), 8_000);
    return authedFetch('/api/admin/tasks')
      .then(data => {
        if (!live.current) applyTasks(asTasks(data.tasks));
        const next = asPrefs(data.prefs);
        if (next) setPrefs(next);
        if (data.setupNeeded) setNote(typeof data.message === 'string' ? data.message : '');
        else setNote('');
      })
      .catch(error => setNote(error instanceof Error ? error.message : 'The Action Centre could not be loaded.'))
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
  }, [applyTasks]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    let stopSnapshot = () => {};
    const stopAuth = onAuthStateChanged(auth, user => {
      stopSnapshot();
      if (!user) {
        setLoading(false);
        return;
      }
      void load();
      const staffRole = profile?.adminRole === 'super_admin' ? 'super_admin' : profile?.role === 'admin' ? 'admin' : '';
      const staffPost = typeof (profile as { staffPost?: string } | null)?.staffPost === 'string'
        ? (profile as { staffPost?: string }).staffPost
        : '';
      const list = query(
        collection(db, ADMIN_TASKS),
        where('status', 'in', ['open', 'claimed', 'snoozed']),
        limit(100),
      );
      stopSnapshot = onSnapshot(list, snap => {
        live.current = true;
        const next = snap.docs
          .map(doc => parseAdminTask(doc.id, doc.data()))
          .filter((task): task is AdminTask => task !== null)
          .map(task => presentTask(task, { staffRole, staffPost }));
        applyTasks(next);
        setLoading(false);
      }, () => {
        live.current = false;
        setLoading(false);
      });
    });
    return () => {
      stopAuth();
      stopSnapshot();
    };
  }, [applyTasks, load, profile]);

  const act = async (body: { id: string; action: string; reason?: string; snoozedUntil?: number }) => {
    await authedFetch('/api/admin/tasks', { method: 'POST', body: JSON.stringify(body) });
    live.current = false;
    await load();
  };

  const actMany = async (body: { ids: string[]; action: string; reason?: string; snoozedUntil?: number }) => {
    const data = await authedFetch('/api/admin/tasks', { method: 'POST', body: JSON.stringify(body) });
    live.current = false;
    await load();
    const failures = Array.isArray(data.failures) ? data.failures.length : 0;
    if (failures > 0) setNote(`${failures} task${failures === 1 ? '' : 's'} could not be updated.`);
    return data;
  };

  const savePrefs = async (next: AdminPushPrefs) => {
    const data = await authedFetch('/api/admin/tasks/prefs', { method: 'POST', body: JSON.stringify(next) });
    const saved = asPrefs(data.prefs);
    if (saved) setPrefs(saved);
  };

  return { tasks, prefs, note, setNote, loading, load, act, actMany, savePrefs };
}
