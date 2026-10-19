'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudioTimetableChat } from '@/components/timetable/studio';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { ET_COPY } from '@/lib/studio/et-copy';
import { STUDIO_TIMETABLE } from '@/lib/studio-paths';
import { studioTimetableGate, type TimetableActor } from '@/lib/timetable/access';
import { parseTimetableChat } from '@/lib/timetable/chat';
import { TIMETABLE_COPY } from '@/lib/timetable/copy';
import { decodeDataUrl, parsePaperTimetable, textChunksFromPng } from '@/lib/timetable/paper';

type Tab = 'ask' | 'timetable' | 'exams' | 'apps' | 'more';

/** Full-page ET AI canvas inside the dashboard shell. No nested frames. */
export function EtCanvas({ name, actor, editorHref = STUDIO_TIMETABLE }: { name: string; actor?: TimetableActor | null; editorHref?: string }) {
  const profile = useAuthSTORE(state => state.profile);
  const user = useAuthSTORE(state => state.user);
  const resolved: TimetableActor = actor ?? {
    uid: user?.uid,
    role: profile?.role,
    roles: profile?.roles,
    permissions: profile?.permissions,
    institutionId: profile?.institutionId,
    childIds: profile?.childIds,
    plan: profile?.role === 'admin' ? 'enterprise' : undefined,
  };
  const gate = studioTimetableGate(resolved);
  const [tab, setTab] = useState<Tab>('ask');
  const [subject, setSubject] = useState<string>(ET_COPY.subjects[0]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState<{ id: number; text: string } | null>(null);
  const [voiceNote, setVoiceNote] = useState('');
  const first = name.trim().split(' ')[0] || 'there';
  const showTimetable = gate !== 'hidden';

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (query && parseTimetableChat(query) && gate !== 'hidden') {
      setTab('timetable');
      setSeed({ id: 1, text: query });
    }
  }, [gate]);

  const handoff = (message: string) => {
    setTab('timetable');
    setSeed({ id: Date.now(), text: message });
  };

  const ask = async (message: string) => {
    if (!message) return;
    if (showTimetable && parseTimetableChat(message)) {
      handoff(message);
      return;
    }
    setBusy(true);
    try {
      const data = await authedFetch('/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ message, persona: subject }),
      });
      const answer = typeof data.reply === 'string' ? data.reply : typeof data.message === 'string' ? data.message : '';
      setReply(answer || ET_COPY.emptyReply);
    } catch {
      setReply(ET_COPY.emptyReply);
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const host = window as Window & {
      SpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null };
      webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null };
    };
    const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceNote(ET_COPY.voiceMissing);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.onresult = (event) => {
      const heard = event.results?.[0]?.[0]?.transcript ?? '';
      setText(heard);
      setVoiceNote('');
      if (showTimetable && parseTimetableChat(heard)) handoff(heard);
    };
    setVoiceNote(ET_COPY.listening);
    recognition.start();
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file || !showTimetable) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = textChunksFromPng(bytes).join('\n');
    if (parsePaperTimetable(text).length === 0) {
      let binary = '';
      bytes.forEach(byte => { binary += String.fromCharCode(byte); });
      const image = `data:${file.type || 'image/png'};base64,${btoa(binary)}`;
      if (decodeDataUrl(image)) {
        try {
          const response = await fetch('/api/timetable/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image }),
          });
          if (response.ok) {
            const body = await response.json() as { text?: string };
            if (body.text) text = body.text;
          }
        } catch {
          text = '';
        }
      }
    }
    if (parsePaperTimetable(text).length === 0) {
      setVoiceNote(TIMETABLE_COPY.studioUnread);
      return;
    }
    handoff(text);
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col bg-[#0B1417] text-white" data-et-canvas="1">
      <div className="flex flex-wrap gap-2 px-4 pt-4" role="tablist" aria-label={ET_COPY.ask} data-studio-header="1">
        {(['ask', 'exams', 'apps', 'more'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === item ? 'bg-[#3FE0D0] text-[#203337]' : 'text-white/70'}`}
          >
            {ET_COPY[item]}
          </button>
        ))}
        {showTimetable ? (
          <button
            type="button"
            role="tab"
            data-studio-tab="timetable"
            aria-selected={tab === 'timetable'}
            onClick={() => setTab('timetable')}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === 'timetable' ? 'bg-[#3FE0D0] text-[#203337]' : 'text-white/70'}`}
          >
            {TIMETABLE_COPY.studioTab}
          </button>
        ) : null}
        {showTimetable ? (
          <button type="button" data-action="studio-quick" className="min-h-11 rounded-full border border-[#3FE0D0] px-4 text-sm font-semibold text-[#3FE0D0]" onClick={() => handoff(TIMETABLE_COPY.studioQuick)}>
            {TIMETABLE_COPY.studioQuick}
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto px-6 py-6 text-center">
        {tab === 'ask' ? (
          <>
            <p className="text-2xl font-semibold">{ET_COPY.hi} {first}, {ET_COPY.welcome}</p>
            <button type="button" onClick={() => void ask(text)} className="mt-8 flex h-36 w-36 items-center justify-center rounded-full bg-[#3FE0D0] text-sm font-bold text-[#203337] shadow-[0_0_40px_rgba(63,224,208,0.45)]">
              {ET_COPY.start}
            </button>
            {reply ? <p className="mt-6 max-w-xl text-sm text-white/80">{reply}</p> : null}
            {voiceNote ? <p className="mt-3 text-sm text-white/70">{voiceNote}</p> : null}
          </>
        ) : null}
        {tab === 'timetable' && showTimetable ? (
          <StudioTimetableChat actor={resolved} editorHref={editorHref} seed={seed?.text} seedId={seed?.id ?? 0} />
        ) : null}
        {tab === 'exams' ? <Link href="/dashboard/studio/exam-prep" className="text-[#3FE0D0]">{ET_COPY.exams}</Link> : null}
        {tab === 'apps' ? <Link href="/dashboard/studio" className="text-[#3FE0D0]">{ET_COPY.apps}</Link> : null}
        {tab === 'more' ? <Link href="/ai-teachers" className="text-[#3FE0D0]">{ET_COPY.more}</Link> : null}
      </div>
      <form
        className="m-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#17282D] px-3 py-2"
        onSubmit={(event) => { event.preventDefault(); void ask(text.trim()); }}
      >
        <label className="sr-only" htmlFor="et-subject">{ET_COPY.subject}</label>
        <select id="et-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-full bg-transparent px-2 text-sm text-[#3FE0D0]">
          {ET_COPY.subjects.map((item) => <option key={item} value={item} className="text-[#203337]">{item}</option>)}
        </select>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={ET_COPY.placeholder}
          aria-label={ET_COPY.placeholder}
          className="min-h-11 flex-1 bg-transparent text-sm outline-none"
          disabled={busy}
        />
        <button type="button" className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#3FE0D0]" data-action="mic" onClick={listen}>{ET_COPY.mic}</button>
        <label className="min-h-11 rounded-full px-3 text-sm font-semibold text-[#3FE0D0]">
          {ET_COPY.image}
          <input type="file" accept="image/*" className="sr-only" data-action="photo" aria-label={ET_COPY.image} onChange={event => { void onPhoto(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" disabled={busy}>
          {ET_COPY.talk}
        </button>
      </form>
    </div>
  );
}
