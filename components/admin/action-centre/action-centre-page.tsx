'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_ADMIN_PUSH_PREFS, type AdminPushPrefs, type AdminTaskPriority, type AdminTaskStatus, type AdminTaskType } from '@/lib/admin/tasks';
import { TaskList } from './task-list';
import { useAdminTasks } from './use-admin-tasks';

const fieldClass = 'min-h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm text-[#203337]';
const buttonClass = 'inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]';

const TYPES: Array<AdminTaskType | 'all'> = ['all', 'registration', 'safeline_case', 'teacher_verification', 'institution_verification', 'report', 'partner_application', 'amber_request', 'course_review', 'other'];
const TIERS: Array<AdminTaskPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const STATUSES: Array<AdminTaskStatus | 'all'> = ['all', 'open', 'claimed', 'snoozed'];

export function ActionCentrePage() {
  const params = useSearchParams();
  const selectedId = params.get('task') ?? '';
  const { tasks, prefs, note, setNote, loading, act, savePrefs } = useAdminTasks();
  const [type, setType] = useState<(typeof TYPES)[number]>('all');
  const [tier, setTier] = useState<(typeof TIERS)[number]>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [draft, setDraft] = useState<AdminPushPrefs>(DEFAULT_ADMIN_PUSH_PREFS);
  const now = Date.now();

  useEffect(() => {
    if (prefs) setDraft(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`task-${selectedId}`)?.scrollIntoView({ block: 'center' });
  }, [selectedId, tasks]);

  const visible = useMemo(() => tasks.filter(task => {
    if (type !== 'all' && task.type !== type) return false;
    if (tier !== 'all' && task.slaTier !== tier) return false;
    if (status !== 'all' && task.status !== status) return false;
    return true;
  }), [tasks, type, tier, status]);

  const save = () => {
    savePrefs({ ...draft, categories: { ...draft.categories, emergency: true } })
      .then(() => setNote('Notification preferences saved. Emergency stays on.'))
      .catch(error => setNote(error instanceof Error ? error.message : 'Preferences did not save.'));
  };

  return (
    <div className="space-y-5 pb-24" data-admin-tasks="1">
      <header className="ps-hero-panel rounded-[24px] px-5 py-6 text-white">
        <p className="text-sm font-medium">Admin desk</p>
        <h1 className="font-heading text-4xl tracking-tight">Action Centre</h1>
        <p className="mt-1 max-w-xl text-sm">Work that is waiting on an admin. SafeLine names stay on the source document.</p>
      </header>
      {note ? <p className="text-sm text-[#1E6A83]" role="status">{note}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-[#203337]">
          Type
          <select className={`${fieldClass} mt-1`} value={type} onChange={event => setType(event.target.value as (typeof TYPES)[number])}>
            {TYPES.map(item => <option key={item} value={item}>{item === 'all' ? 'All types' : item.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#203337]">
          SLA
          <select className={`${fieldClass} mt-1`} value={tier} onChange={event => setTier(event.target.value as (typeof TIERS)[number])}>
            {TIERS.map(item => <option key={item} value={item}>{item === 'all' ? 'All tiers' : item}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#203337]">
          Status
          <select className={`${fieldClass} mt-1`} value={status} onChange={event => setStatus(event.target.value as (typeof STATUSES)[number])}>
            {STATUSES.map(item => <option key={item} value={item}>{item === 'all' ? 'Open, claimed, snoozed' : item}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="text-sm text-[#203337]">Loading tasks…</p> : <TaskList tasks={visible} now={now} selectedId={selectedId} onAct={act} />}
      <section className="rounded-[24px] border border-border bg-card p-4" aria-label="Push preferences">
        <h2 className="font-heading text-xl text-[#203337]">Push preferences</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">Stored at users/&#123;uid&#125;/notificationPrefs/admin. Quiet hours never mute emergency.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#203337]">
            Mode
            <select className={`${fieldClass} mt-1`} value={draft.mode} onChange={event => setDraft({ ...draft, mode: event.target.value === 'digest' ? 'digest' : 'instant' })}>
              <option value="instant">Instant</option>
              <option value="digest">Digest</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[#203337]">
            Digest times
            <input className={`${fieldClass} mt-1`} value={draft.digestTimes.join(', ')} onChange={event => setDraft({ ...draft, digestTimes: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })} />
          </label>
          <label className="text-sm font-semibold text-[#203337]">
            Quiet hours start
            <input className={`${fieldClass} mt-1`} value={draft.quietHours.start} onChange={event => setDraft({ ...draft, quietHours: { ...draft.quietHours, start: event.target.value } })} />
          </label>
          <label className="text-sm font-semibold text-[#203337]">
            Quiet hours end
            <input className={`${fieldClass} mt-1`} value={draft.quietHours.end} onChange={event => setDraft({ ...draft, quietHours: { ...draft.quietHours, end: event.target.value } })} />
          </label>
          <label className="text-sm font-semibold text-[#203337]">
            Time zone
            <input className={`${fieldClass} mt-1`} value={draft.quietHours.tz} onChange={event => setDraft({ ...draft, quietHours: { ...draft.quietHours, tz: event.target.value } })} />
          </label>
          <label className="mt-6 flex min-h-11 items-center gap-2 text-sm font-semibold text-[#203337]">
            <input type="checkbox" checked={draft.categories.admin} onChange={event => setDraft({ ...draft, categories: { admin: event.target.checked, emergency: true } })} />
            Admin channel
          </label>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-[#203337]">
          <input type="checkbox" checked disabled />
          Emergency channel stays on
        </label>
        <button type="button" className={`${buttonClass} mt-3`} onClick={save}>Save preferences</button>
      </section>
    </div>
  );
}
