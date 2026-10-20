'use client';

import { TaskCard } from './task-card';
import type { AdminTask } from '@/lib/admin/tasks';

export function TaskList({
  tasks,
  now,
  selectedId,
  onAct,
}: {
  tasks: AdminTask[];
  now: number;
  selectedId: string;
  onAct: (body: { id: string; action: string; reason?: string; snoozedUntil?: number }) => Promise<void>;
}) {
  if (tasks.length === 0) {
    return <p className="rounded-[24px] border border-border bg-card px-4 py-6 text-sm text-[#203337]">Nothing is waiting.</p>;
  }
  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} now={now} selected={task.id === selectedId} onAct={onAct} />
      ))}
    </div>
  );
}
