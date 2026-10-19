'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { markNotificationRead, markAllNotificationsRead, Notification } from '@/lib/db';
import { useAuthSTORE } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { groupNotices } from '@/lib/dashboard/home';

const TYPE_COLORS: Record<string, string> = {
  grade: 'bg-success/15 text-success',
  assignment: 'bg-blue-100 text-blue-700',
  announcement: 'bg-purple-100 text-purple-700',
  exam: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)]',
  payment: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)]',
  integrity: 'bg-red-100 text-red-700',
  message: 'bg-teal-100 text-teal-700',
  general: 'bg-gray-100 text-gray-700',
};

export function NotificationsBell({ tone = 'default' }: { tone?: 'default' | 'onDark' } = {}) {
  const { user } = useAuthSTORE();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function handleClick(n: Notification) {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className={`relative ${tone === 'onDark' ? 'text-[#EDEAE4] hover:bg-white/10' : 'text-gray-600'}`}
        aria-label="Notifications"
        onClick={() => setOpen(o => !o)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No notifications yet</p>
            )}
            {groupNotices(notifications).map(group => (
              <section key={group.category} className="border-t border-border">
                <h2 className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</h2>
                {group.items.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex min-h-12 w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted ${!n.read ? 'bg-accent/60' : ''}`}
                  >
                    <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[n.type] ?? TYPE_COLORS.general}`}>
                      {n.type}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{n.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
                      {n.createdAt && (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true })}
                        </span>
                      )}
                    </span>
                    {!n.read && <span className="ms-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
