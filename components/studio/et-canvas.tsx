'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';
import { ET_COPY } from '@/lib/studio/et-copy';
import { AI_TEACHERS } from '@/lib/ai-teachers';
import { TeacherPortrait } from '@/components/teachers/portrait';

const SUBJECT_FACE: Record<string, string> = {
  Mathematics: 'et-maths',
  Biology: 'et-biology',
  Science: 'et-science',
  Law: 'et-law',
  Medicine: 'et-medicine',
  Mandarin: 'et-mandarin',
  English: 'et-english',
};

type Tab = 'ask' | 'exams' | 'apps' | 'more';

/** Full-page ET AI canvas inside the dashboard shell. No nested frames. */
export function EtCanvas({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>('ask');
  const [subject, setSubject] = useState<string>(ET_COPY.subjects[0]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const first = name.trim().split(' ')[0] || 'there';
  const face = AI_TEACHERS.find((teacher) => teacher.id === (SUBJECT_FACE[subject] || 'et-ai')) ?? AI_TEACHERS[AI_TEACHERS.length - 1];

  const ask = async () => {
    const message = text.trim();
    if (!message) return;
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

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col bg-[#0B1417] text-white" data-et-canvas="1">
      <div className="flex gap-2 px-4 pt-4" role="tablist" aria-label={ET_COPY.ask}>
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
      </div>
      <header className="flex items-center gap-3 px-4 pt-3" data-et-teacher={face?.id}>
        {face ? <TeacherPortrait teacher={face} size={48} className="h-12 w-12 rounded-full object-cover" /> : null}
        <p className="text-sm font-semibold">{face?.name}</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {tab === 'ask' ? (
          <>
            <p className="text-2xl font-semibold">{ET_COPY.hi} {first}, {ET_COPY.welcome}</p>
            <button type="button" onClick={() => void ask()} className="mt-8 flex h-36 w-36 items-center justify-center rounded-full bg-[#3FE0D0] text-sm font-bold text-[#203337] shadow-[0_0_40px_rgba(63,224,208,0.45)]">
              {ET_COPY.start}
            </button>
            {reply ? <p className="mt-6 max-w-xl text-sm text-white/80">{reply}</p> : null}
          </>
        ) : null}
        {tab === 'exams' ? <Link href="/dashboard/studio/exam-prep" className="text-[#3FE0D0]">{ET_COPY.exams}</Link> : null}
        {tab === 'apps' ? <Link href="/dashboard/studio" className="text-[#3FE0D0]">{ET_COPY.apps}</Link> : null}
        {tab === 'more' ? <Link href="/ai-teachers" className="text-[#3FE0D0]">{ET_COPY.more}</Link> : null}
      </div>
      <form
        className="m-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#17282D] px-3 py-2"
        onSubmit={(event) => { event.preventDefault(); void ask(); }}
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
        <button type="submit" className="min-h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" disabled={busy}>
          {ET_COPY.talk}
        </button>
      </form>
    </div>
  );
}
