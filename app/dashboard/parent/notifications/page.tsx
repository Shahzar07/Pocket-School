'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getNotifications, Notification } from '@/lib/db';

export default function ParentNotificationsPage() {
  const { user } = useAuthSTORE();
  const [rows, setRows] = useState<Notification[]>([]);
  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then(setRows).catch(() => setRows([]));
  }, [user]);
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-600">Notifications</p>
      <h1 className="font-heading text-4xl">Updates</h1>
      {rows.length === 0 && <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">You are up to date. Link requests and school messages will show up here.</p>}
      <ul className="space-y-2">
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
