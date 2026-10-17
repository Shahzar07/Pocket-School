'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Phone, Shield } from 'lucide-react';
import { authedFetch, postJSON } from '@/lib/authed-fetch';
import { emergencyNumber } from '@/lib/emergency/policy';
import { SAFETY_TYPE_OPTIONS, SupportCard, TrackerCard } from '@/components/safety/surfaces';
import type { Helpline, TrackerStage } from '@/lib/safety/policy';

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

export function SafetyDesk({ country = 'Malaysia' }: { country?: string }) {
  const number = emergencyNumber(country);
  const [description, setDescription] = useState('');
  const [who, setWho] = useState('');
  const [where, setWhere] = useState('');
  const [when, setWhen] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reports, setReports] = useState<TrackerItem[]>([]);
  const [lines, setLines] = useState<Helpline[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dangerNote, setDangerNote] = useState('');
  const [dontTell, setDontTell] = useState(false);
  const [shareLocation, setShareLocation] = useState(false);
  const [dangerType, setDangerType] = useState('');
  const [concernRole, setConcernRole] = useState('');
  const [concernWho, setConcernWho] = useState('');

  useEffect(() => {
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
  }, []);

  const send = async (type: string) => {
    setBusy(true);
    setNote('');
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
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (shareLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 });
        }).catch(() => null);
        if (position) {
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        }
      }
      const created = await postJSON<{ parentsExcluded: boolean; locationShared: boolean }>('/api/safety/danger', {
        type: dangerType,
        dontTellParents: dontTell,
        concernRole,
        who: concernWho,
        shareLocation,
        lat,
        lng,
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

  return (
    <div className="grid gap-4">
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
            <input className="min-h-12 rounded-xl border border-border px-3 font-normal" value={where} onChange={event => setWhere(event.target.value)} aria-label="Where" />
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

      {reports.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Your report</h2>
          <p className="text-sm text-muted-foreground">Nothing sent yet. Staff notes are never shown here.</p>
        </section>
      ) : reports.map(report => <TrackerCard key={report.id} stage={report.tracker} />)}

      <SupportCard lines={lines.length ? lines : undefined} />

      <form onSubmit={event => void onDanger(event)} className="rounded-2xl border border-border bg-card p-4 grid gap-3">
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
          Share my location once
        </label>
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#D0553F] text-white font-bold inline-flex items-center justify-center gap-2">
          <Phone aria-hidden="true" />
          I&apos;m in danger now
        </button>
        {dangerNote ? <p className="text-sm font-semibold">{dangerNote}</p> : null}
      </form>
    </div>
  );
}
