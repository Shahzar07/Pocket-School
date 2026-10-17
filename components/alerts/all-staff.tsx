'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ALL_STAFF_LABELS, ALL_STAFF_TYPES, type AllStaffType } from '@/lib/alerts/all-staff';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { AlertCard, EmptyState, StatCard } from '@/components/dashboard/cards';
import { authedFetch, postJSON } from '@/lib/authed-fetch';

export interface StaffAlertCard {
  id: string;
  type: AllStaffType;
  typeLabel: string;
  location: string;
  instruction: string;
  status: 'open' | 'cleared';
  publicDescription: string;
  checkIn: 'safe' | 'need_help' | 'no_response';
}

interface RollCallPayload {
  alert: StaffAlertCard | null;
  counts: { safe: number; needHelp: number; noResponse: number };
  needHelp: { uid: string; name: string }[];
  canClear?: boolean;
}

export function WidenAllStaff({ source, sourceId }: { source: 'case' | 'emergency'; sourceId: string }) {
  const [type, setType] = useState<AllStaffType>('lockdown');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const widen = async () => {
    setPending(true);
    setMessage('');
    try {
      await postJSON('/api/all-staff/widen', { source, sourceId, type, location, reason, publicDescription });
      setMessage('All staff have been alerted. Roll-call is open.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The alert was not sent.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 grid gap-3">
      <h2 className="font-bold">Widen to all staff</h2>
      <p className="text-sm text-muted-foreground">One tap tells every staff member. Private report details stay off the staff banner.</p>
      <label className="grid gap-1 text-sm font-semibold">Alert type
        <select className="min-h-12 rounded-xl border px-3" value={type} onChange={event => setType(event.target.value as AllStaffType)} aria-label="All-staff alert type">
          {ALL_STAFF_TYPES.map(item => <option key={item} value={item}>{ALL_STAFF_LABELS[item]}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">Location in school
        <input className="min-h-12 rounded-xl border px-3" value={location} onChange={event => setLocation(event.target.value)} placeholder="Block B, first floor" aria-label="Location in school" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Reason
        <textarea className="min-h-24 rounded-xl border px-3 py-2" value={reason} onChange={event => setReason(event.target.value)} aria-label="Reason for widening" />
      </label>
      {type === 'missing_child_on_site' ? (
        <label className="grid gap-1 text-sm font-semibold">Description staff may see
          <textarea className="min-h-24 rounded-xl border px-3 py-2" value={publicDescription} onChange={event => setPublicDescription(event.target.value)} aria-label="Description staff may see" />
        </label>
      ) : null}
      <button type="button" className="min-h-12 rounded-xl bg-primary text-primary-foreground font-bold" disabled={pending} onClick={() => void widen()}>
        {pending ? 'Sending' : 'Widen to all staff'}
      </button>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </section>
  );
}

export function AllStaffBanner() {
  const [alert, setAlert] = useState<StaffAlertCard | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let gone = false;
    void authedFetch('/api/all-staff/banner').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => ({})) as { alert?: StaffAlertCard | null };
      if (!gone) setAlert(data.alert ?? null);
    }).catch(() => undefined);
    return () => { gone = true; };
  }, []);

  const checkIn = async (status: 'safe' | 'need_help') => {
    if (!alert) return;
    try {
      await postJSON('/api/all-staff/check-in', { id: alert.id, status });
      setAlert({ ...alert, checkIn: status });
      setMessage(status === 'safe' ? 'Marked safe.' : 'Help has been sent to the principal.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Check-in failed.');
    }
  };

  if (!alert || alert.status !== 'open') return null;
  return (
    <div className="mb-4 grid gap-3">
      <AlertCard tone="critical" title={alert.typeLabel} detail={`${alert.location}. ${alert.instruction}`} />
      {alert.publicDescription ? <p className="text-sm">{alert.publicDescription}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-12 rounded-xl bg-primary px-4 text-primary-foreground font-bold" onClick={() => void checkIn('safe')}>I am safe</button>
        <button type="button" className="min-h-12 rounded-xl border px-4 font-bold" onClick={() => void checkIn('need_help')}>Need help</button>
        <Link href="/dashboard/staff/roll-call" className="min-h-12 inline-flex items-center rounded-xl border px-4 font-bold">Roll-call</Link>
      </div>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </div>
  );
}

export function RollCallBoard({ sample }: { sample?: RollCallPayload }) {
  const [payload, setPayload] = useState<RollCallPayload | null>(sample ?? null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (sample) return;
    let gone = false;
    void authedFetch('/api/all-staff/roll-call').then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (gone) return;
      if (!res.ok) setMessage(typeof data.error === 'string' ? data.error : 'Roll-call is not available.');
      else setPayload(data as RollCallPayload);
    });
    return () => { gone = true; };
  }, [sample]);

  const clear = async () => {
    if (!payload?.alert) return;
    if (sample) {
      setMessage('All clear sent. Roll-call is closed.');
      setPayload({ ...payload, alert: { ...payload.alert, status: 'cleared' } });
      return;
    }
    try {
      await postJSON('/api/all-staff/clear', { id: payload.alert.id });
      setMessage('All clear sent. Roll-call is closed.');
      setPayload({ ...payload, alert: { ...payload.alert, status: 'cleared' } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'All clear was not sent.');
    }
  };

  const counts = payload?.counts ?? { safe: 0, needHelp: 0, noResponse: 0 };
  return (
    <DashPage>
      <DashHeader eyebrow="All-staff alert" title="Staff roll-call" description="Counts only. The private report is not on this screen." />
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
      {payload?.alert ? (
        <AlertCard
          tone={payload.alert.status === 'open' ? 'critical' : 'good'}
          title={payload.alert.typeLabel}
          detail={`${payload.alert.location}. ${payload.alert.instruction}`}
        />
      ) : <EmptyState title="No all-staff alert" detail="When a lead widens a case, the roll-call opens here." />}
      {payload?.alert?.publicDescription ? <p className="text-sm">{payload.alert.publicDescription}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Safe" value={String(counts.safe)} hint="Checked in safe" />
        <StatCard label="Need help" value={String(counts.needHelp)} hint="Escalated to the principal" />
        <StatCard label="No response" value={String(counts.noResponse)} hint="Still to check in" />
      </div>
      {payload?.needHelp && payload.needHelp.length > 0 ? (
        <ul className="grid gap-2">
          {payload.needHelp.map(row => <li key={row.uid} className="rounded-xl border px-3 py-2 text-sm font-semibold">{row.name} needs help</li>)}
        </ul>
      ) : null}
      {payload?.canClear && payload.alert?.status === 'open' ? (
        <button type="button" className="min-h-12 rounded-xl bg-primary px-4 text-primary-foreground font-bold" onClick={() => void clear()}>Send all clear</button>
      ) : null}
    </DashPage>
  );
}

export function AllStaffSample() {
  const alert: StaffAlertCard = {
    id: 'sample',
    type: 'lockdown',
    typeLabel: 'Lockdown',
    location: 'Block B, first floor',
    instruction: 'Stay in the room. Lock the door. Stay quiet and away from windows. Wait for an all-clear.',
    status: 'open',
    publicDescription: '',
    checkIn: 'no_response',
  };
  return (
    <div className="grid gap-4">
      <AlertCard tone="critical" title={alert.typeLabel} detail={`${alert.location}. ${alert.instruction}`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-12 rounded-xl bg-primary px-4 text-primary-foreground font-bold">I am safe</button>
        <button type="button" className="min-h-12 rounded-xl border px-4 font-bold">Need help</button>
      </div>
      <RollCallBoard sample={{
        alert,
        counts: { safe: 18, needHelp: 1, noResponse: 4 },
        needHelp: [{ uid: 'staff-1', name: 'Mr Tan' }],
        canClear: true,
      }} />
      <section className="rounded-2xl border border-border bg-card p-4 grid gap-2">
        <h2 className="font-bold">Widen to all staff</h2>
        <p className="text-sm">Location in school: Block B, first floor. Reason recorded in the audit.</p>
      </section>
    </div>
  );
}
