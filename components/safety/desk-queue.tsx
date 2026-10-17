'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { AlertCard, EmptyState, StatCard } from '@/components/dashboard/cards';

interface DeskCase {
  id: string;
  source: string;
  safetyType: string;
  title: string;
  status: string;
  assigneeUid: string;
  createdAt: number;
  slaDueAt: number;
  overdue: boolean;
  flagged: boolean;
  parentsExcluded: boolean;
}

interface RotaSlot {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  primaryUid: string;
  backupUid: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SAMPLE_CASES: DeskCase[] = [
  {
    id: 'desk-sample',
    source: 'danger_now',
    safetyType: 'unsafe_other',
    title: 'Help requested outside a school',
    status: 'pending',
    assigneeUid: '',
    createdAt: Date.now() - 6 * 60 * 1000,
    slaDueAt: Date.now() + 20 * 60 * 1000,
    overdue: false,
    flagged: false,
    parentsExcluded: true,
  },
];

function clock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function SafetyDeskQueue({ sample = false }: { sample?: boolean }) {
  const [cases, setCases] = useState<DeskCase[]>(sample ? SAMPLE_CASES : []);
  const [slots, setSlots] = useState<RotaSlot[]>(sample ? [{ weekday: 1, startMinutes: 480, endMinutes: 1020, primaryUid: 'on-call', backupUid: 'backup' }] : []);
  const [timezone, setTimezone] = useState('Asia/Kuala_Lumpur');
  const [note, setNote] = useState(sample ? 'Sample queue. Nothing is saved.' : '');
  const [assignee, setAssignee] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');
  const [primaryUid, setPrimaryUid] = useState('');
  const [backupUid, setBackupUid] = useState('');

  useEffect(() => {
    if (sample) return;
    void (async () => {
      const [queue, rota] = await Promise.all([
        fetch('/api/safety-desk/queue').then(response => response.json()),
        fetch('/api/safety-desk/rota').then(response => response.json()),
      ]);
      if (Array.isArray(queue.cases)) setCases(queue.cases);
      if (Array.isArray(rota.slots)) setSlots(rota.slots);
      if (typeof rota.timezone === 'string') setTimezone(rota.timezone);
      if (queue.error) setNote(queue.error);
    })();
  }, [sample]);

  const open = cases.filter(item => item.status === 'pending' || item.status === 'in_progress').length;
  const overdue = cases.filter(item => item.overdue).length;

  async function assign(ticketId: string) {
    if (sample) {
      setCases(current => current.map(item => item.id === ticketId ? { ...item, assigneeUid: assignee || 'on-call', status: 'in_progress' } : item));
      setNote('Assignment recorded on this sample desk.');
      return;
    }
    const response = await fetch('/api/safety-desk/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId, assigneeUid: assignee }),
    });
    const body = await response.json();
    setNote(body.error || 'Case assigned.');
  }

  async function saveRota(event: FormEvent) {
    event.preventDefault();
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const next = {
      weekday: Number(weekday),
      startMinutes: startHour * 60 + startMinute,
      endMinutes: endHour * 60 + endMinute,
      primaryUid,
      backupUid,
    };
    const payload = { timezone, slots: [...slots.filter(slot => slot.weekday !== next.weekday || slot.startMinutes !== next.startMinutes), next] };
    if (sample) {
      setSlots(payload.slots);
      setNote('Rota recorded on this sample desk.');
      return;
    }
    const response = await fetch('/api/safety-desk/rota', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (Array.isArray(body.slots)) setSlots(body.slots);
    setNote(body.error || 'On-call rota saved.');
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow="Poket School"
        title="Safety Desk"
        description="Reports from people without a school. Acknowledge within five minutes or the backup is called."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open cases" value={String(open)} hint="Pending or in progress" />
        <StatCard label="Over SLA" value={String(overdue)} hint="Past the case deadline" />
        <StatCard label="On-call slots" value={String(slots.length)} hint={timezone} />
      </div>
      {overdue > 0 ? <AlertCard tone="critical" title="A case is past its SLA" detail="Assign it before the backup window closes." /> : null}
      {cases.length === 0 ? <EmptyState title="The desk is clear" detail="New reports from people without a school appear here." /> : (
        <ul className="grid gap-3">
          {cases.map(item => (
            <li key={item.id} className="rounded-[24px] border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{item.status}</p>
              <h2 className="mt-1 font-heading text-xl">{item.title || item.safetyType || 'Safety report'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.parentsExcluded ? 'Parents were not notified.' : 'Linked guardians at tier 2 were included.'}
                {item.overdue ? ' SLA missed.' : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="min-h-12 rounded-xl border border-border px-3" value={assignee} onChange={event => setAssignee(event.target.value)} aria-label="Assignee" placeholder="Staff user id" />
                <button type="button" className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground" onClick={() => void assign(item.id)}>Assign</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-3 rounded-[24px] border border-border bg-card p-4" onSubmit={event => void saveRota(event)}>
        <h2 className="font-heading text-xl">On-call rota</h2>
        <p className="text-sm text-muted-foreground">Primary is called first. Backup is added if nobody acknowledges within five minutes.</p>
        <label className="grid gap-1 text-sm font-semibold">Weekday
          <select className="min-h-12 rounded-xl border border-border px-3 font-normal" value={weekday} onChange={event => setWeekday(event.target.value)} aria-label="Weekday">
            {WEEKDAYS.map((day, index) => <option key={day} value={String(index)}>{day}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Start
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" type="time" value={start} onChange={event => setStart(event.target.value)} aria-label="Start time" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">End
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" type="time" value={end} onChange={event => setEnd(event.target.value)} aria-label="End time" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Primary
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={primaryUid} onChange={event => setPrimaryUid(event.target.value)} aria-label="Primary on call" placeholder="User id" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Backup
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={backupUid} onChange={event => setBackupUid(event.target.value)} aria-label="Backup on call" placeholder="User id" />
        </label>
        <button type="submit" className="min-h-12 rounded-xl bg-foreground px-4 font-bold text-background">Save rota</button>
        <ul className="text-sm text-muted-foreground">
          {slots.map(slot => (
            <li key={`${slot.weekday}-${slot.startMinutes}`}>{WEEKDAYS[slot.weekday]} {clock(slot.startMinutes)}–{clock(slot.endMinutes)}</li>
          ))}
        </ul>
      </form>
      {note ? <p className="text-sm font-semibold">{note}</p> : null}
    </DashPage>
  );
}
