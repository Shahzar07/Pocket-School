'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import Link from 'next/link';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';
import { studioTimetableGate, type StudioTimetableGate, type TimetableActor } from '@/lib/timetable/access';
import { previewIntent, previewTimetableChat, type TimetablePreview } from '@/lib/timetable/chat';
import { decodeDataUrl, parsePaperTimetable, textChunksFromPng } from '@/lib/timetable/paper';
import { loadBundle, saveDoc } from '@/lib/timetable/store';
import type { TimetableDoc } from '@/lib/timetable/types';
import { TimetableDesk } from './desk';
import { TimetableGrid } from './grid';

const button = 'h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-50';
const ghost = 'h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]';

function docFor(gate: StudioTimetableGate): TimetableDoc {
  const bundle = loadBundle();
  return gate === 'personal' ? bundle.personal : bundle.school;
}

export function TimetableUpsell({ gate }: { gate: StudioTimetableGate }) {
  const locked = gate === 'hidden' || gate === 'upsell-personal' || gate === 'upsell-school';
  return (
    <section className="rounded-3xl border border-[#1E6A83]/20 bg-white p-5 text-[#203337]" data-timetable-locked={locked ? '1' : '0'} data-upsell={gate.startsWith('upsell') ? '1' : '0'}>
      <h2 className="font-heading text-2xl">{TIMETABLE_COPY.studioTab}</h2>
      <p className="mt-2 text-sm text-[#1E6A83]">{gate === 'hidden' ? TIMETABLE_COPY.studioHidden : TIMETABLE_COPY.studioUpsell}</p>
      {gate === 'upsell-school' ? <p className="mt-2 text-sm">{TIMETABLE_COPY.studioUpsellSchool}</p> : null}
      {gate === 'upsell-personal' ? <p className="mt-2 text-sm">{TIMETABLE_COPY.studioUpsellPersonal}</p> : null}
      <Link href="/pricing" className="mt-4 inline-flex h-10 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">{TIMETABLE_COPY.priceNote}</Link>
    </section>
  );
}

export function StudioTimetableRoute() {
  const { user, profile, loading } = useAuthSTORE();
  if (loading) return null;
  const actor: TimetableActor = {
    uid: user?.uid,
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
    institutionId: profile?.institutionId,
    childIds: profile?.childIds,
    plan: profile?.role === 'admin' ? 'enterprise' : undefined,
  };
  return <StudioTimetableScreen actor={actor} />;
}

export function StudioTimetableScreen({ actor }: { actor: TimetableActor }) {
  const gate = studioTimetableGate(actor);
  if (gate !== 'personal' && gate !== 'school') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background p-6" data-studio-timetable="1" data-nested-frame="0">
        <TimetableUpsell gate={gate} />
      </div>
    );
  }
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background" data-studio-timetable="1" data-nested-frame="0" data-studio-edition={gate}>
      <TimetableDesk surface={gate === 'personal' ? 'personal' : 'institution'} actor={actor} />
    </div>
  );
}

function listenOnce(onText: (text: string) => void): boolean {
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return false;
  const recognition = new Ctor();
  recognition.lang = 'en-GB';
  recognition.onresult = (event) => {
    onText(event.results?.[0]?.[0]?.transcript ?? '');
  };
  recognition.start();
  return true;
}

interface SpeechRec {
  lang: string;
  start: () => void;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
}

export function StudioTimetableChat({
  actor,
  editorHref,
  seed,
  seedId = 0,
}: {
  actor: TimetableActor;
  editorHref: string;
  seed?: string;
  seedId?: number;
}) {
  const gate = studioTimetableGate(actor);
  const [pending, setPending] = useState<TimetablePreview | null>(null);
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [applied, setApplied] = useState(0);

  const proposeText = (message: string) => {
    if (gate !== 'personal' && gate !== 'school') {
      setPending(null);
      setNotice(gate === 'hidden' ? TIMETABLE_COPY.studioHidden : TIMETABLE_COPY.studioUpsell);
      return true;
    }
    const preview = previewTimetableChat(docFor(gate), message);
    if (!preview) return false;
    setPending(preview);
    setNotice(preview.summary);
    return true;
  };

  useEffect(() => {
    if (seedId && seed) proposeText(seed);
    // seedId marks a new utterance from the studio composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId]);

  const confirm = async () => {
    if (!pending?.confirmable || (gate !== 'personal' && gate !== 'school')) return;
    saveDoc({
      ...pending.doc,
      audit: [{
        id: `audit-studio-${pending.doc.audit.length + 1}`,
        at: new Date().toISOString(),
        actorId: actor.uid || 'et-ai',
        action: 'studio-confirm',
        detail: pending.summary,
      }, ...pending.doc.audit],
    });
    const notices = pending.notices;
    setPending(null);
    setNotice(TIMETABLE_COPY.studioApplied);
    setApplied(value => value + 1);
    if (notices.length === 0) return;
    try {
      const { createNotification } = await import('@/lib/db');
      for (const item of notices) await createNotification(item).catch(() => undefined);
    } catch {
      /* The preview already listed the notices. */
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await file.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach(byte => { binary += String.fromCharCode(byte); });
      return `data:${file.type || 'image/png'};base64,${btoa(binary)}`;
    });
    const bytes = decodeDataUrl(dataUrl);
    let rows = bytes ? parsePaperTimetable(textChunksFromPng(bytes).join('\n')) : [];
    try {
      const response = await fetch('/api/timetable/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (response.ok) {
        const body = await response.json() as { rows?: { day: 'mon'; period: string; subject: string; level: string; teacher: string; room: string }[] };
        if (body.rows && body.rows.length > 0) rows = body.rows;
      }
    } catch {
      /* A photo with embedded text still previews on this device. */
    }
    if (gate !== 'personal' && gate !== 'school') {
      setNotice(TIMETABLE_COPY.studioUpsell);
      return;
    }
    if (rows.length === 0) {
      setPending(null);
      setNotice(TIMETABLE_COPY.studioUnread);
      return;
    }
    const preview = previewIntent(docFor(gate), { type: 'import', rows });
    setPending(preview);
    setNotice(preview.summary);
  };

  if (gate === 'upsell-personal' || gate === 'upsell-school' || gate === 'hidden') {
    return <TimetableUpsell gate={gate} />;
  }

  const live = pending?.doc ?? docFor(gate);

  return (
    <div className="w-full max-w-5xl rounded-3xl bg-white p-4 text-start text-[#203337]" data-studio-chat="1" data-applied={applied}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl">{TIMETABLE_COPY.studioTab}</h2>
        <Link href={editorHref} className={ghost + ' inline-flex items-center'} data-action="open-grid">{TIMETABLE_COPY.studioOpen}</Link>
      </div>
      <p className="mt-1 text-sm text-[#1E6A83]">{TIMETABLE_COPY.studioNeedsConfirm}</p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!proposeText(text)) setNotice(TIMETABLE_COPY.studioBlurb);
        }}
      >
        <input
          value={text}
          onChange={event => setText(event.target.value)}
          aria-label={TIMETABLE_COPY.studioBlurb}
          data-action="timetable-text"
          className="h-10 min-w-[16rem] flex-1 rounded-xl border border-[#1E6A83]/30 px-3 text-sm"
        />
        <button type="button" className={ghost} data-action="mic-timetable" onClick={() => {
          setListening(true);
          const started = listenOnce((heard) => {
            setListening(false);
            setText(heard);
            proposeText(heard);
          });
          if (!started) {
            setListening(false);
            setNotice(TIMETABLE_COPY.studioVoiceMissing);
          }
        }}
        >
          {listening ? TIMETABLE_COPY.studioListening : TIMETABLE_COPY.studioMic}
        </button>
        <label className={ghost + ' inline-flex cursor-pointer items-center'}>
          {TIMETABLE_COPY.studioPhoto}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            data-action="photo-timetable"
            aria-label={TIMETABLE_COPY.studioPhoto}
            onChange={event => { void onPhoto(event.target.files?.[0]); event.target.value = ''; }}
          />
        </label>
        <button type="submit" className={button} data-action="ask-timetable">{TIMETABLE_COPY.studioPreview}</button>
      </form>
      {notice ? <p className="mt-3 text-sm" data-notice="1">{notice}</p> : null}
      {pending ? (
        <div className="mt-4 space-y-3" data-preview-diff="1" data-diff={pending.changes.length} data-confirmable={pending.confirmable ? '1' : '0'}>
          <h3 className="font-semibold">{TIMETABLE_COPY.studioPreview}</h3>
          <ul className="text-sm text-[#1E6A83]">
            {pending.changes.map((change, index) => <li key={`${change.kind}-${index}`}>{change.label}</li>)}
          </ul>
          <div className="max-h-[50vh] overflow-auto">
            <TimetableGrid doc={pending.doc} lessons={pending.doc.lessons} selectedId="" onSelect={() => undefined} onMove={() => undefined} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} data-action="confirm-timetable" disabled={!pending.confirmable} onClick={() => void confirm()}>{TIMETABLE_COPY.studioConfirm}</button>
            <button type="button" className={ghost} data-action="cancel-timetable" onClick={() => { setPending(null); setNotice(TIMETABLE_COPY.studioCancel); }}>{TIMETABLE_COPY.studioCancel}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="max-h-[50vh] overflow-auto">
            <TimetableGrid doc={live} lessons={live.lessons} selectedId="" onSelect={() => undefined} onMove={() => undefined} />
          </div>
        </div>
      )}
    </div>
  );
}
