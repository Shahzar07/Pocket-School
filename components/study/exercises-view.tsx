'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, Eye, Check } from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';
import type { Exercise } from '@/lib/study/types';

/**
 * Work it on paper, then compare with the full worked solution and mark
 * yourself honestly — the way students actually revise from past papers.
 */
export function ExercisesView({ exercises, onComplete, extraAction }: {
  exercises: Exercise[];
  onComplete: (score: number) => void;
  /** Optional per-exercise action, e.g. "work through it with ET AI". */
  extraAction?: (ex: Exercise, index: number) => React.ReactNode;
}) {
  const [state, setState] = useState<Record<number, { hint?: boolean; open?: boolean; self?: number; work?: string }>>({});
  const total = exercises.reduce((s, e) => s + (e.marks || 1), 0);
  const marked = exercises.every((_, i) => state[i]?.self !== undefined);
  const got = exercises.reduce((s, e, i) => s + (state[i]?.self ?? 0), 0);
  const [reported, setReported] = useState(false);

  const set = (i: number, patch: Partial<{ hint: boolean; open: boolean; self: number; work: string }>) =>
    setState(s => ({ ...s, [i]: { ...s[i], ...patch } }));

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {exercises.map((ex, i) => {
        const st = state[i] ?? {};
        return (
          <div key={i} className="rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Exercise {i + 1}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">[{ex.marks} marks]</span>
            </div>
            <div className="text-[15px] text-foreground leading-relaxed [&_p]:my-1"><MathMarkdown>{ex.prompt}</MathMarkdown></div>
            <textarea value={st.work ?? ''} onChange={e => set(i, { work: e.target.value })} rows={3} placeholder="Your working (optional — paper is fine too)…"
              className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-primary" />
            <div className="flex flex-wrap gap-2 mt-3">
              {ex.hint?.trim() && <button onClick={() => set(i, { hint: !st.hint })} className="h-9 px-3.5 rounded-full border border-border text-[13px] font-semibold inline-flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-[var(--ps-cyan-text)]" /> {st.hint ? 'Hide hint' : 'Hint'}</button>}
              <button onClick={() => set(i, { open: true })} className="h-9 px-3.5 rounded-full bg-foreground text-background text-[13px] font-semibold inline-flex items-center gap-1.5"><Eye className="w-4 h-4" /> Show worked solution</button>
              {extraAction?.(ex, i)}
            </div>
            {st.hint && <div className="mt-3 text-[13px] rounded-xl bg-[var(--ps-cyan-soft)] border border-[var(--ps-cyan-border)] text-[var(--ps-cyan-text)] px-3 py-2 [&_p]:my-0"><MathMarkdown>{ex.hint}</MathMarkdown></div>}
            {st.open && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-muted/50 border border-border p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1">Worked solution</p>
                <div className="text-[14px] leading-relaxed [&_p]:my-1"><MathMarkdown>{ex.solution}</MathMarkdown></div>
                <div className="mt-2 text-[14px]"><span className="font-semibold">Answer: </span><span className="[&_p]:inline"><MathMarkdown>{ex.answer}</MathMarkdown></span></div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] text-muted-foreground mr-1">Marks you earned:</span>
                  {Array.from({ length: (ex.marks || 1) + 1 }, (_, m) => (
                    <button key={m} onClick={() => set(i, { self: m })}
                      className={`w-8 h-8 rounded-lg text-[13px] font-bold tabular-nums border ${st.self === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}>{m}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between rounded-2xl bg-muted/40 border border-border px-5 py-3">
        <span className="text-[14px] text-foreground">Score: <span className="font-bold tabular-nums">{got} / {total}</span></span>
        <button disabled={!marked || reported} onClick={() => { setReported(true); onComplete(Math.round((got / Math.max(1, total)) * 100)); }}
          className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
          <Check className="w-4 h-4" /> {reported ? 'Saved' : marked ? 'Save my score' : 'Mark every exercise to finish'}
        </button>
      </div>
    </div>
  );
}
