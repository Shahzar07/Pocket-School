'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Phone, Shield } from 'lucide-react';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { emergencyNumber } from '@/lib/emergency/policy';
import { SAFETY_TYPE_OPTIONS, SupportCard, TrackerCard } from '@/components/safety/surfaces';
import { DEFAULT_HELPLINES, WHERE_PLACES, type Helpline, type TrackerStage } from '@/lib/safety/policy';

interface TrackerItem {
  id: string;
  safetyType: string;
  tracker: TrackerStage;
  createdAt: number;
  flagged: boolean;
}

async function fileAsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] ?? 0);
  return btoa(binary);
}

const WHERE_LABEL: Record<(typeof WHERE_PLACES)[number], string> = {
  in_school: 'At school',
  online: 'Online',
  transport: 'On the way',
  other: 'Somewhere else',
};

export function SafetyDesk({
  country = 'Malaysia',
  sample = false,
  focus = 'report',
}: {
  country?: string;
  sample?: boolean;
  focus?: 'report' | 'danger';
}) {
  const number = emergencyNumber(country);
  const [description, setDescription] = useState('');
  const [who, setWho] = useState('');
  const [where, setWhere] = useState('');
  const [when, setWhen] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reports, setReports] = useState<TrackerItem[]>([]);
  const [lines, setLines] = useState<Helpline[]>(sample ? DEFAULT_HELPLINES : []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dangerNote, setDangerNote] = useState('');
  const [dontTell, setDontTell] = useState(false);
  const [shareLocation, setShareLocation] = useState(focus === 'danger');
  const [place, setPlace] = useState(focus === 'danger' ? 'School gate' : '');
  const [dangerType, setDangerType] = useState('');
  const [concernRole, setConcernRole] = useState('');
  const [concernWho, setConcernWho] = useState('');

  useEffect(() => {
    if (sample) return;
    let gone = false;
    void (async () => {
      const [trackerRes, helpRes] = await Promise.all([
        authedFetch('/api/safety/tracker'),
        authedFetch('/api/safety/helplines'),
      ]);
      const tracker = await trackerRes.json().catch(() => ({}));
      const help = await helpRes.json().catch(() => ({}));
      if (gone) return;
      if (Array.isArray(tracker.reports)) setReports(tracker.reports as TrackerItem[]);
      if (Array.isArray(help.lines)) setLines(help.lines as Helpline[]);
    })();
    return () => { gone = true; };
  }, [sample]);

  const send = async (type: string) => {
    setBusy(true);
    setNote('');
    if (sample) {
      setReports(current => [{ id: `sample-${type}`, safetyType: type, tracker: 'received', createdAt: Date.now(), flagged: false }, ...current]);
      setNote('Sent. The safeguarding lead has this.');
      setBusy(false);
      return;
    }
    try {
      const created = await postJSON<{ id: string; tracker: TrackerStage; flagged: boolean }>('/api/safety/report', {
        type,
        description,
        who,
        where,
        when,
      });
      if (file) {
        await postJSON('/api/hotline/attach', {
          ticketId: created.id,
          label: 'evidence',
          mime: file.type || 'application/octet-stream',
          fileName: file.name,
          dataBase64: await fileAsBase64(file),
        });
      }
      setReports(current => [{ id: created.id, safetyType: type, tracker: created.tracker, createdAt: Date.now(), flagged: created.flagged }, ...current]);
      setDescription('');
      setWho('');
      setWhere('');
      setWhen('');
      setFile(null);
      setNote(created.flagged ? 'Sent. The school has this, and it was flagged for a follow-up.' : 'Sent. The safeguarding lead has this.');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const onDanger = async (event: FormEvent) => {
    event.preventDefault();
    setDangerNote(`Call ${number}. Telling your school now.`);
    setBusy(true);
    if (sample) {
      setDangerNote(dontTell
        ? `Call ${number}. Your school has been told. Parents were not notified.`
        : `Call ${number}. Your school and your linked parents have been told.`);
      setBusy(false);
      return;
    }
    try {
      const created = await postJSON<{ parentsExcluded: boolean; locationShared: boolean }>('/api/safety/danger', {
        type: dangerType,
        dontTellParents: dontTell,
        concernRole,
        who: concernWho,
        shareLocation,
        place: shareLocation ? place : '',
      });
      setDangerNote(created.parentsExcluded
        ? `Call ${number}. Your school has been told. Parents were not notified.`
        : `Call ${number}. Your school and your linked parents have been told.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Try again in a moment.';
      setDangerNote(`Call ${number}. ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const reportForm = (
      <section className="rounded-2xl border border-border bg-card p-4 grid gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><Shield aria-hidden="true" /> What is happening?</h2>
        <div className="flex flex-wrap gap-2">
          {SAFETY_TYPE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              disabled={busy}
              onClick={() => void send(option.id)}
              className="min-h-12 rounded-xl border border-border px-4 font-semibold"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Tap a type to send. A description, who, where, when, and evidence are optional.</p>
        <label className="grid gap-1 text-sm font-semibold">
          Description
          <textarea className="min-h-24 rounded-xl border border-border p-3 font-normal" value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional" aria-label="Description" />
        </label>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="grid gap-1 text-sm font-semibold">Who
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={who} onChange={event => setWho(event.target.value)} aria-label="Who" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Where
            <select className="min-h-12 rounded-xl border border-border px-3 font-normal" value={where} onChange={event => setWhere(event.target.value)} aria-label="Where this happened">
              <option value="">Not sure</option>
              {WHERE_PLACES.map(placeId => <option key={placeId} value={placeId}>{WHERE_LABEL[placeId]}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">When
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={when} onChange={event => setWhen(event.target.value)} aria-label="When" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Evidence
          <input type="file" aria-label="Evidence" onChange={event => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {note ? <p className="text-sm">{note}</p> : null}
      </section>
  );

  const tracker = reports.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Your report</h2>
          <p className="text-sm text-muted-foreground">Nothing sent yet. Staff notes are never shown here.</p>
        </section>
      ) : reports.map(report => <TrackerCard key={report.id} stage={report.tracker} />);

  const dangerForm = (
      <form id="danger-now" onSubmit={event => void onDanger(event)} className="rounded-2xl border border-border bg-card p-4 grid gap-3">

        <p className="text-xs font-bold tracking-widest text-[#D0553F]">EMERGENCY</p>
        <p className="text-4xl font-extrabold">Call {number}</p>
        <p className="text-sm text-muted-foreground">This is the emergency number for your country. Call it now if you can.</p>
        <label className="grid gap-1 text-sm font-semibold">If this is about abuse or a person
          <select className="min-h-12 rounded-xl border border-border px-3 font-normal" value={dangerType} onChange={event => setDangerType(event.target.value)} aria-label="Danger type">
            <option value="">I need help now</option>
            {SAFETY_TYPE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Who is involved
          <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={concernWho} onChange={event => setConcernWho(event.target.value)} aria-label="Who is involved" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Their role
          <select className="min-h-12 rounded-xl border border-border px-3 font-normal" value={concernRole} onChange={event => setConcernRole(event.target.value)} aria-label="Concern role">
            <option value="">Not sure</option>
            <option value="parent">Parent</option>
            <option value="guardian">Guardian</option>
            <option value="student">Student</option>
          </select>
        </label>
        <label className="min-h-12 flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={dontTell} onChange={event => setDontTell(event.target.checked)} />
          Don&apos;t tell my parents
        </label>
        <label className="min-h-12 flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={shareLocation} onChange={event => setShareLocation(event.target.checked)} />
          Share a place once
        </label>
        {shareLocation ? (
          <label className="grid gap-1 text-sm font-semibold">Place
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={place} onChange={event => setPlace(event.target.value)} aria-label="Place to share once" placeholder="Classroom, gate, or bus stop" />
          </label>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#D0553F] text-white font-bold inline-flex items-center justify-center gap-2">
          <Phone aria-hidden="true" />
          I&apos;m in danger now
        </button>
        {dangerNote ? <p className="text-sm font-semibold">{dangerNote}</p> : null}
      </form>
  );

  return (
    <div className="grid gap-4">
      {focus === 'danger' ? dangerForm : null}
      {reportForm}
      {tracker}
      <SupportCard lines={lines.length ? lines : undefined} />
      {focus === 'report' ? dangerForm : null}
    </div>
  );
}
