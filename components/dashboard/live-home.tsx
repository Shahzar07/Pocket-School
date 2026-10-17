'use client';

import { useEffect, useState } from 'react';
import { coachStorageKey, roleHome, tileStorageKey, type DashRole } from '@/lib/dashboard/home';
import type { PreviewAlert, PreviewBadge, PreviewChild, PreviewRow, PreviewStat } from '@/lib/dashboard/preview';
import { HomeView } from './home-view';

export function DashboardHome({
  role,
  name,
  stats,
  alerts = [],
  rows = [],
  listTitle,
  children = [],
  badges = [],
  showMap = false,
  loading = false,
}: {
  role: DashRole;
  name: string;
  stats?: PreviewStat[];
  alerts?: PreviewAlert[];
  rows?: PreviewRow[];
  listTitle?: string;
  children?: PreviewChild[];
  badges?: PreviewBadge[];
  showMap?: boolean;
  loading?: boolean;
}) {
  const home = roleHome(role);
  const [order, setOrder] = useState<string[] | undefined>(undefined);
  const [coach, setCoach] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(tileStorageKey(role));
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) setOrder(parsed);
      }
      setCoach(window.localStorage.getItem(coachStorageKey(role)) !== 'seen');
    } catch {
      setCoach(true);
    }
    setReady(true);
  }, [role]);

  const saveOrder = (next: string[]) => {
    setOrder(next);
    try { window.localStorage.setItem(tileStorageKey(role), JSON.stringify(next)); } catch { /* private mode */ }
  };

  const dismiss = () => {
    setCoach(false);
    try { window.localStorage.setItem(coachStorageKey(role), 'seen'); } catch { /* private mode */ }
  };

  return (
    <div className="mb-8">
      <HomeView
        role={role}
        name={name || home.label}
        stats={stats ?? []}
        alerts={alerts}
        rows={rows}
        listTitle={listTitle ?? 'Today'}
        children={children}
        badges={badges}
        showMap={showMap}
        tileOrder={order}
        onTileOrder={saveOrder}
        loading={loading || !ready}
        showCoach={coach}
        onDismissCoach={dismiss}
        arranging={arranging}
        onArrange={setArranging}
      />
    </div>
  );
}
