'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getNotifications, Notification } from '@/lib/db';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { readingNotices } from '@/lib/platform/notifications';
import { progressMap } from '@/lib/shelf/storage';

export default function ParentNotificationsPage() {
  const { user } = useAuthSTORE();
  const { profile, ready } = useShelfProfile();
  const [rows, setRows] = useState<Notification[]>([]);
  const [reading, setReading] = useState<ReturnType<typeof readingNotices>>([]);
  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then(setRows).catch(() => setRows([]));
  }, [user]);
  useEffect(() => {
    if (!ready) return;
    setReading(readingNotices(progressMap(profile.id)));
  }, [ready, profile.id]);
  const empty = rows.length === 0 && reading.length === 0;
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--ps-cyan-text)]">Notifications</p>
      <h1 className="font-heading text-4xl">Updates</h1>
      {empty && <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">You are up to date. Link requests and school messages will show up here.</p>}
      <ul className="space-y-2">
        {reading.map((n) => (
          <li key={n.id}>
            <Link href={n.href} className="block rounded-2xl border border-border px-4 py-3 hover:bg-muted">
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </Link>
          </li>
        ))}
        {rows.map((n) => (
          <li key={n.id} className="rounded-2xl border border-border px-4 py-3">
            <p className="font-semibold text-sm">{n.title}</p>
            <p className="text-sm text-muted-foreground">{n.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
