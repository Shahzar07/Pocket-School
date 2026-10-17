'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import type { AccountabilityStats, LevelAccountability } from '@/lib/alerts/accountability';
import type { LevelCount, ProgressAlertView, ProgressSettings } from '@/lib/alerts/progress';
import { ProgressBoard, type ProgressTrend } from './progress-board';

export function ProgressScreen({
  scope,
  mode,
  eyebrow,
  title,
  description,
  settingsId,
}: {
  scope: 'student' | 'child' | 'class' | 'institution' | 'platform';
  mode: 'student' | 'parent' | 'teacher' | 'institution' | 'admin';
  eyebrow: string;
  title: string;
  description: string;
  settingsId?: string;
}) {
  const { profile } = useAuthSTORE();
  const children = profile?.childIds ?? [];
  const [childId, setChildId] = useState(children[0] ?? '');
  const [alerts, setAlerts] = useState<ProgressAlertView[]>([]);
  const [levels, setLevels] = useState<LevelCount[]>([]);
  const [trend, setTrend] = useState<ProgressTrend | null>(null);
  const [previous, setPrevious] = useState<ProgressTrend | null>(null);
  const [settings, setSettings] = useState<ProgressSettings | null>(null);
  const [stats, setStats] = useState<AccountabilityStats | null>(null);
  const [levelStats, setLevelStats] = useState<LevelAccountability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (children[0] && !childId) setChildId(children[0]);
  }, [children, childId]);

  useEffect(() => {
    if (scope === 'child' && !childId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const query = scope === 'child' ? `scope=child&childId=${encodeURIComponent(childId)}` : `scope=${scope}`;
    authedFetch(`/api/progress-alerts?${query}`)
      .then((data) => {
        if (!live) return;
        setAlerts(Array.isArray(data.alerts) ? data.alerts as ProgressAlertView[] : []);
        setLevels(Array.isArray(data.levels) ? data.levels as LevelCount[] : []);
        setTrend(data.trend && typeof data.trend === 'object' ? data.trend as ProgressTrend : null);
        setPrevious(data.previous && typeof data.previous === 'object' ? data.previous as ProgressTrend : null);
        setStats(data.stats && typeof data.stats === 'object' ? data.stats as AccountabilityStats : null);
        setLevelStats(Array.isArray(data.levelStats) ? data.levelStats as LevelAccountability[] : []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Progress alerts could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [scope, childId]);

  useEffect(() => {
    if (!settingsId) return;
    let live = true;
    authedFetch(`/api/progress-alerts/settings?institutionId=${encodeURIComponent(settingsId)}`)
      .then((data) => {
        if (!live) return;
        const next = data.settings;
        if (next && typeof next === 'object') setSettings(next as ProgressSettings);
      })
      .catch(() => {
        if (live) setSettings(null);
      });
    return () => { live = false; };
  }, [settingsId]);

  return (
    <div className="space-y-4">
      {scope === 'child' && (
        <label className="block text-sm">
          Child
          <select className="mt-1 rounded-xl border border-border bg-card px-3 py-1.5" value={childId} onChange={(event) => setChildId(event.target.value)}>
            {children.length === 0 && <option value="">No linked child</option>}
            {children.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      )}
      <ProgressBoard
        mode={mode}
        eyebrow={eyebrow}
        title={title}
        description={description}
        alerts={alerts}
        levels={levels}
        trend={trend}
        previous={previous}
        loading={loading}
        error={error}
        interactive
        settings={settings}
        stats={stats}
        levelStats={levelStats}
        onWorkflow={async (id, action, extra) => {
          await authedFetch('/api/progress-alerts', {
            method: 'POST',
            body: JSON.stringify({ id, action, ...extra }),
          });
          setAlerts((current) => current.map((alert) => {
            if (alert.id !== id) return alert;
            if (action === 'acknowledge' && alert.status === 'open') return { ...alert, status: 'acknowledged' };
            if (action === 'resolve') return { ...alert, status: 'resolved' };
            if (action === 'assign') return { ...alert, status: 'assigned' };
            return alert;
          }));
        }}
        onSaveSettings={settings ? async (next) => {
          await authedFetch('/api/progress-alerts/settings', {
            method: 'POST',
            body: JSON.stringify({ institutionId: settingsId, settings: next }),
          });
          setSettings(next);
        } : undefined}
      />
    </div>
  );
}
