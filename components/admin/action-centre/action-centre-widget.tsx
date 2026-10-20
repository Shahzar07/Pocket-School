'use client';

import Link from 'next/link';
import { countdown } from '@/lib/admin/tasks';
import { useAdminTasks } from './use-admin-tasks';

export function ActionCentreWidget() {
  const { tasks, loading } = useAdminTasks();
  const now = Date.now();
  const top = tasks.slice(0, 3);
  return (
    <section aria-label="Action Centre" className="rounded-[24px] border border-border bg-card p-4" data-admin-task-widget="1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-[#203337]">Action Centre</h2>
        <Link href="/dashboard/admin/tasks" className="text-sm font-semibold text-[#1E6A83]">Open</Link>
      </div>
      {loading ? <p className="text-sm text-[#203337]">Loading tasks…</p> : null}
      {!loading && top.length === 0 ? <p className="text-sm text-[#203337]">Nothing is waiting.</p> : null}
      <ul className="space-y-2">
        {top.map(task => {
          const clock = countdown(task.dueAt, now);
          return (
            <li key={task.id}>
              <Link href={`/dashboard/admin/tasks?task=${encodeURIComponent(task.id)}`} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-muted">
                <span>
                  <span className="block text-sm font-semibold text-[#203337]">{task.title}</span>
                  <span className="text-xs text-[#1E6A83]">{task.slaTier}</span>
                </span>
                <span className={`text-sm font-semibold ${clock.overdue ? 'text-[#8E2F2F]' : 'text-[#203337]'}`}>
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
