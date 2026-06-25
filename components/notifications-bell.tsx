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

const TYPE_COLORS: Record<string, string> = {
  grade: 'bg-green-100 text-green-700',
  assignment: 'bg-blue-100 text-blue-700',
  announcement: 'bg-purple-100 text-purple-700',
  exam: 'bg-orange-100 text-orange-700',
  payment: 'bg-yellow-100 text-yellow-700',
  integrity: 'bg-red-100 text-red-700',
  message: 'bg-teal-100 text-teal-700',
  general: 'bg-gray-100 text-gray-700',
};

export function NotificationsBell() {
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
        className="relative text-gray-600"
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
          <div className="max-h-80 overflow-y-auto divide-y divide-muted">
            {notifications.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No notifications yet</p>
            )}
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${TYPE_COLORS[n.type] ?? TYPE_COLORS.general}`}>
                    {n.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    {n.createdAt && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow((n.createdAt as any).toDate(), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5 ml-auto" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
