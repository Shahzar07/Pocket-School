'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countdown, deepLinkFor } from '@/lib/admin/tasks';
import { useAdminTasks } from './use-admin-tasks';

const SEEN_KEY = 'poket-admin-task-seen';

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function TaskBell() {
  const router = useRouter();
  const { tasks } = useAdminTasks();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = Date.now();
  const waiting = tasks.filter(task => task.status === 'open' || task.status === 'claimed');
  const unread = waiting.filter(task => !seen.includes(task.id));

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={panelRef} data-admin-task-bell="1">
      <Button
        variant="ghost"
        size="icon"
        className="relative text-gray-600"
        aria-label={unread.length > 0 ? `Action Centre, ${unread.length} unread` : 'Action Centre'}
        aria-expanded={open}
        onClick={() => {
          setOpen(value => !value);
          const next = [...new Set([...seen, ...waiting.map(task => task.id)])].slice(-200);
          setSeen(next);
          window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
        }}
      >
        <ListTodo className="h-5 w-5" />
        {unread.length > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#203337] px-1 text-[10px] font-bold text-white" data-unread-count={unread.length}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#203337]">Action Centre</p>
            <Link href="/dashboard/admin/tasks" className="text-sm font-semibold text-[#1E6A83]" onClick={() => setOpen(false)}>
              Open
            </Link>
          </div>
          {waiting.length === 0 ? <p className="text-sm text-[#203337]">Nothing is waiting.</p> : null}
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {waiting.slice(0, 5).map(task => {
              const clock = countdown(task.dueAt, now);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-2 py-2 text-left hover:bg-muted"
                    onClick={() => { setOpen(false); router.push(deepLinkFor(task.id)); }}
                  >
                    <span className="block text-sm font-semibold text-foreground">{task.title}</span>
                    <span className={`text-xs ${clock.overdue ? 'text-[#8E2F2F]' : 'text-[#1E6A83]'}`}>
                      {task.slaTier} · {clock.overdue ? clock.label : `${clock.label} left`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
