'use client';

import { useState } from 'react';
import Link from 'next/link';
import { countdown, deepLinkFor, resolutionProblem, sourceHref, type AdminTask } from '@/lib/admin/tasks';

const buttonClass = 'inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-50';
const quietClass = 'inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-[#203337]';

export function TaskCard({
  task,
  now,
  selected,
  onAct,
}: {
  task: AdminTask;
  now: number;
  selected: boolean;
  onAct: (body: { id: string; action: string; reason?: string; snoozedUntil?: number }) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clock = countdown(task.dueAt, now);
  const needsReason = resolutionProblem('dismiss', reason) !== '';

  const run = (action: string, extra?: { snoozedUntil?: number }) => {
    if ((action === 'dismiss' || action === 'reject') && needsReason) {
      setError('A reason is required to reject or dismiss.');
      return;
    }
    setBusy(true);
    setError('');
    onAct({ id: task.id, action, reason, snoozedUntil: extra?.snoozedUntil })
      .catch(err => setError(err instanceof Error ? err.message : 'That action did not save.'))
      .finally(() => setBusy(false));
  };

  return (
    <article
      id={`task-${task.id}`}
      data-admin-task="1"
      data-task-id={task.id}
      data-sla={task.slaTier}
      className={`rounded-[24px] border bg-card p-4 ${selected ? 'border-[#203337] ring-2 ring-[#3FE0D0]' : 'border-border'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1E6A83]">{task.slaTier} · {task.type.replace(/_/g, ' ')}</p>
          <h2 className="font-heading text-2xl text-[#203337]">{task.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#203337]">{task.summary}</p>
        </div>
        <p className={`text-sm font-semibold ${clock.overdue ? 'text-[#8E2F2F]' : 'text-[#203337]'}`} data-countdown="1">
          {clock.overdue ? clock.label : `${clock.label} left`}
        </p>
      </div>
      <p className="mt-3 text-sm text-[#1E6A83]">
        {task.status === 'claimed' && task.claimedBy ? 'Claimed' : task.status}
        {task.status === 'snoozed' && task.snoozedUntil ? ` until ${new Date(task.snoozedUntil).toLocaleString()}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={sourceHref(task)} className={quietClass}>Open source</Link>
        <Link href={deepLinkFor(task.id)} className={quietClass}>Task link</Link>
        <p className="w-full text-xs text-[#1E6A83]">Source path {task.entityPath}</p>
      </div>
      <label className="mt-4 block text-sm font-semibold text-[#203337]">
        Reason
        <textarea
          value={reason}
          onChange={event => { setReason(event.target.value); setError(''); }}
          className="mt-1 min-h-20 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Required for reject or dismiss"
          data-task-reason="1"
        />
      </label>
      {needsReason ? <p className="mt-1 text-sm text-[#1E6A83]">A reason is required to reject or dismiss.</p> : null}
      {error ? <p className="mt-1 text-sm text-[#8E2F2F]" role="alert">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={() => run('claim')}>Claim</button>
        <button type="button" className={buttonClass} disabled={busy} onClick={() => run('done')}>Done</button>
        <button type="button" className={buttonClass} disabled={busy || needsReason} onClick={() => run('dismiss')}>Dismiss</button>
        <button type="button" className={buttonClass} disabled={busy || needsReason} onClick={() => run('reject')}>Reject</button>
        <button type="button" className={quietClass} disabled={busy} onClick={() => run('snooze', { snoozedUntil: Date.now() + 60 * 60 * 1000 })}>Snooze 1 hour</button>
        <button type="button" className={quietClass} disabled={busy} onClick={() => run('snooze', { snoozedUntil: Date.now() + 4 * 60 * 60 * 1000 })}>Snooze 4 hours</button>
        {task.status === 'snoozed' ? <button type="button" className={quietClass} disabled={busy} onClick={() => run('unsnooze')}>Unsnooze</button> : null}
      </div>
    </article>
  );
}
