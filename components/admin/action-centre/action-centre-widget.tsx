'use client';

import Link from 'next/link';
import { countdown, countByType } from '@/lib/admin/tasks';
import { useAdminTasks } from './use-admin-tasks';

export function ActionCentreWidget() {
  const { tasks, loading } = useAdminTasks();
  const now = Date.now();
  const top = tasks.slice(0, 3);
  const counts = countByType(tasks);
  return (
    <section aria-label="Action Centre" className="rounded-[24px] border border-border bg-card p-4" data-admin-task-widget="1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-foreground">Action Centre</h2>
        <Link href="/dashboard/admin/tasks" className="text-sm font-semibold text-[#1E6A83]">Open</Link>
      </div>
      {counts.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" data-task-counts="1">
          {counts.map(row => (
            <li key={row.type} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              {row.type.replace(/_/g, ' ')} {row.total}
              {row.urgent > 0 ? <span className="text-[#8E2F2F]"> · {row.urgent} urgent</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? <p className="text-sm text-foreground">Loading tasks…</p> : null}
      {!loading && top.length === 0 ? <p className="text-sm text-foreground">Nothing is waiting.</p> : null}
      <ul className="space-y-2">
        {top.map(task => {
          const clock = countdown(task.dueAt, now);
          return (
            <li key={task.id}>
              <Link href={`/dashboard/admin/tasks?task=${encodeURIComponent(task.id)}`} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-muted">
                <span>
                  <span className="block text-sm font-semibold text-foreground">{task.title}</span>
                  <span className="text-xs text-[#1E6A83]">{task.slaTier}</span>
                </span>
                <span className={`text-sm font-semibold ${clock.overdue ? 'text-[#8E2F2F]' : 'text-foreground'}`}>
                  {clock.overdue ? clock.label : `${clock.label} left`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
