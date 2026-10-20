'use client';

import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { sortTasks, type AdminPushPrefs, type AdminTask } from '@/lib/admin/tasks';

function asTasks(value: unknown): AdminTask[] {
  return Array.isArray(value) ? value as AdminTask[] : [];
}

function asPrefs(value: unknown): AdminPushPrefs | null {
  if (!value || typeof value !== 'object') return null;
  return value as AdminPushPrefs;
}

export function useAdminTasks() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [prefs, setPrefs] = useState<AdminPushPrefs | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return authedFetch('/api/admin/tasks')
      .then(data => {
        setTasks(sortTasks(asTasks(data.tasks), Date.now()));
        const next = asPrefs(data.prefs);
        if (next) setPrefs(next);
        if (data.setupNeeded) setNote(typeof data.message === 'string' ? data.message : '');
      })
      .catch(error => setNote(error instanceof Error ? error.message : 'The Action Centre could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (body: { id: string; action: string; reason?: string; snoozedUntil?: number }) => {
    await authedFetch('/api/admin/tasks', { method: 'POST', body: JSON.stringify(body) });
    await load();
  };

  const savePrefs = async (next: AdminPushPrefs) => {
    const data = await authedFetch('/api/admin/tasks/prefs', { method: 'POST', body: JSON.stringify(next) });
    const saved = asPrefs(data.prefs);
    if (saved) setPrefs(saved);
  };

  return { tasks, prefs, note, setNote, loading, load, act, savePrefs };
}
