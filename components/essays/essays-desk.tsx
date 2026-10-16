'use client';

import { useEffect, useRef, useState } from 'react';
import { PenLine, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { EssayDelivery } from '@/components/essays/essay-delivery';
import { importFile } from '@/components/editor/import-file';
import { ESSAY_LEVELS, essayLevelLabel, type EssayLevel } from '@/lib/essays/coaching';
import { draftEssay, essayPdfLines, markEssay, placeNotes, type EssayMark } from '@/lib/essays/mark';
import { useAuthSTORE } from '@/hooks/use-auth';

const STORAGE_KEY = 'poket-et-essays';

interface SavedEssay {
  id: string;
  title: string;
  prompt: string;
  idea: string;
  level: EssayLevel;
  body: string;
  mark: EssayMark | null;
  updatedAt: number;
}

function readHistory(): SavedEssay[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedEssay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(essays: SavedEssay[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(essays.slice(0, 40)));
}

async function refine(kind: 'draft' | 'mark', payload: Record<string, string>): Promise<{ body?: string; mark?: EssayMark } | null> {
  try {
    const res = await fetch('/api/essays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...payload }),
    });
    if (!res.ok) return null;
    return await res.json() as { body?: string; mark?: EssayMark };
  } catch {
    return null;
  }
}

export function EssaysDesk() {
  const email = useAuthSTORE(state => state.user?.email ?? state.profile?.email);
  const [mode, setMode] = useState<'write' | 'mark' | 'history'>('write');
  const [level, setLevel] = useState<EssayLevel>('igcse');
  const [prompt, setPrompt] = useState('');
  const [idea, setIdea] = useState('');
  const [title, setTitle] = useState('Untitled essay');
  const [body, setBody] = useState('');
  const [mark, setMark] = useState<EssayMark | null>(null);
  const [history, setHistory] = useState<SavedEssay[]>([]);
  const activeRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setHistory(readHistory()); }, []);

  function remember(next: { body: string; mark: EssayMark | null; title: string }) {
    const id = activeRef.current ?? crypto.randomUUID();
    activeRef.current = id;
    setHistory(current => {
      const saved: SavedEssay = {
        id,
        title: next.title,
        prompt,
        idea,
        level,
        body: next.body,
        mark: next.mark,
        updatedAt: Date.now(),
      };
      const essays = [saved, ...current.filter(item => item.id !== id)];
      writeHistory(essays);
      return essays;
    });
  }

  async function draft() {
    const local = draftEssay({ idea, prompt, level });
    setTitle(local.title);
    setBody(local.body);
    setMark(null);
    setMode('write');
    remember({ body: local.body, mark: null, title: local.title });
    setBusy(true);
    const remote = await refine('draft', { idea, prompt, level });
    setBusy(false);
    if (remote?.body?.trim()) {
      setBody(remote.body);
      remember({ body: remote.body, mark: null, title: local.title });
    }
  }

  async function markCurrent() {
    if (!body.trim()) {
      toast.error('Paste or draft an essay first.');
      return;
    }
    const local = markEssay({ body, prompt, level });
    setMark(local);
    setMode('mark');
    remember({ body, mark: local, title });
    setBusy(true);
    const remote = await refine('mark', { body, prompt, level });
    setBusy(false);
    if (remote?.mark) {
      setMark(remote.mark);
      remember({ body, mark: remote.mark, title });
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      const result = await importFile(file);
      const text = result.blocks.map(block => [block.title, block.body].filter(Boolean).join('\n')).join('\n\n').trim();
      if (!text) {
        toast.error('ET AI needs the essay as text.');
        return;
      }
      setBody(text);
      setTitle(result.sourceName || file.name);
      setMark(null);
      setMode('mark');
      toast.success('Essay loaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That file could not be read.');
    }
  }

  function openSaved(item: SavedEssay) {
    activeRef.current = item.id;
    setTitle(item.title);
    setPrompt(item.prompt);
    setIdea(item.idea);
    setLevel(item.level);
    setBody(item.body);
    setMark(item.mark);
    setMode(item.mark ? 'mark' : 'write');
  }

  const placed = placeNotes(body, mark?.inline ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-semibold">
          Level
          <select aria-label="Level" value={level} onChange={event => setLevel(event.target.value as EssayLevel)} className="mt-1 block h-11 rounded-xl border border-border bg-background px-3 font-normal">
            {ESSAY_LEVELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="flex rounded-full border border-border p-1" role="tablist" aria-label="ET Essays">
          {(['write', 'mark', 'history'] as const).map(item => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
              className={`h-9 rounded-full px-4 text-sm font-semibold capitalize ${mode === item ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >
              {item === 'history' ? 'History' : item === 'write' ? 'Write' : 'Mark'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'history' ? (
        <ul className="space-y-2">
          {history.length === 0 && <li className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No essays yet. A draft or a mark is kept on this device.</li>}
          {history.map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => openSaved(item)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left">
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-[13px] text-muted-foreground">{essayLevelLabel(item.level)}{item.mark ? ` · ${item.mark.percent}% · ${item.mark.grade91} · ${item.mark.gradeAU}` : ''}</span>
                </span>
                <PenLine className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Question
              <textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="How far does the harbour change the letter?" className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal" />
            </label>
            {mode === 'write' && (
              <label className="block text-sm font-semibold">
                Idea
                <textarea value={idea} onChange={event => setIdea(event.target.value)} placeholder="A harbour that keeps a lost letter" className="mt-1 min-h-16 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal" />
              </label>
            )}
            <label className="block text-sm font-semibold">
              Essay
              <textarea aria-label="Essay" value={body} onChange={event => { setBody(event.target.value); setMark(null); }} placeholder="Paste the essay here, or draft one with ET AI." className="mt-1 min-h-72 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal leading-relaxed" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void draft()} className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                {busy ? 'ET AI is writing…' : 'Draft with ET AI'}
              </button>
              <button type="button" onClick={() => void markCurrent()} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">
                Mark with ET AI
              </button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold">
                <Upload className="h-4 w-4" /> Upload
                <input aria-label="Upload an essay" type="file" accept=".txt,.md,.docx,.pdf,.html,.htm" className="sr-only" onChange={event => { void onUpload(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            {mark ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Score label="Percentage" value={`${mark.percent}%`} />
                  <Score label="9–1" value={mark.grade91} />
                  <Score label="A*–U" value={mark.gradeAU} />
                </div>
                <p className="text-sm leading-relaxed">{mark.summary}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {mark.rubric.map(item => (
                    <li key={item.criterion} className="rounded-2xl border border-border bg-card p-3">
                      <p className="text-sm font-semibold">{item.label} · {item.score}/25</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{item.note}</p>
                    </li>
                  ))}
                </ul>
                <section>
                  <h2 className="text-sm font-semibold">Inline suggestions</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {placed.map((part, index) => part.suggestion ? (
                      <mark key={index} className="bg-amber-100 text-foreground" title={part.suggestion}>{part.text}</mark>
                    ) : <span key={index}>{part.text}</span>)}
                  </p>
                  <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                    {mark.inline.map(note => <li key={note.quote}>{note.suggestion}</li>)}
                    {mark.inline.length === 0 && <li>No sentence needs a mark on this draft.</li>}
                  </ul>
                </section>
                <section>
                  <h2 className="text-sm font-semibold">What to fix next</h2>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    {mark.fixNext.map(item => <li key={item}>{item}</li>)}
                  </ol>
                </section>
                <EssayDelivery
                  title={title}
                  holderEmail={email ?? undefined}
                  lines={essayPdfLines({ title, level, body, mark })}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">
                ET AI drafts from the question and the idea, or marks an essay you paste or upload. The mark shows a percentage, a 9–1 grade, an A*–U grade, and the four-part rubric ET English uses: content, structure, language, and accuracy.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl tracking-[-0.04em]">{value}</p>
    </div>
  );
}
