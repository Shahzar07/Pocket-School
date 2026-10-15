'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';
import { correctIndex } from '@/lib/quiz-answer';
import type { QuizQuestion, TrueFalseItem } from '@/lib/study/types';

/** One question at a time, instant feedback with the reason, score at the end. */
export function QuizView({ questions, onComplete }: { questions: QuizQuestion[]; onComplete: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[i];
  const answerIdx = q ? correctIndex(q.options, q.answer) : -1;

  const next = () => {
    if (i + 1 >= questions.length) {
      setFinished(true);
      onComplete(Math.round((right / questions.length) * 100));
    } else { setI(i + 1); setPicked(null); }
  };

  if (finished) {
    const pct = Math.round((right / questions.length) * 100);
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-2">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</p>
        <p className="font-heading text-2xl text-foreground">{right} / {questions.length} correct</p>
        <p className="text-sm text-muted-foreground mt-1">{pct >= 80 ? 'Strong — this topic is close to mastered.' : pct >= 50 ? 'Getting there. Review the ones you missed, then try harder questions.' : 'Worth another pass at the lesson before re-trying.'}</p>
        <button onClick={() => { setI(0); setPicked(null); setRight(0); setFinished(false); }} className="mt-5 h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-3">
        <span className="tabular-nums">Question {i + 1} of {questions.length}</span>
        <span className="tabular-nums">{right} correct</span>
      </div>
      <div className="flex gap-1 mb-5">{questions.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < i ? 'bg-primary' : k === i ? 'bg-primary/40' : 'bg-muted'}`} />)}</div>
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
          <div className="text-[17px] font-medium text-foreground leading-relaxed mb-4 [&_p]:my-1"><MathMarkdown>{q.question}</MathMarkdown></div>
          <div className="space-y-2">
            {q.options.map((o, k) => {
              const state = picked === null ? 'idle' : k === answerIdx ? 'right' : k === picked ? 'wrong' : 'dim';
              return (
                <button key={k} disabled={picked !== null}
                  onClick={() => { setPicked(k); if (k === answerIdx) setRight(r => r + 1); }}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-[15px] flex items-center gap-3 transition-colors ${
                    state === 'right' ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : state === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : state === 'dim' ? 'border-border opacity-60'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}>
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-[13px] font-bold shrink-0 ${state === 'right' ? 'bg-emerald-600 text-white' : state === 'wrong' ? 'bg-rose-600 text-white' : 'bg-muted text-foreground'}`}>
                    {state === 'right' ? <CheckCircle2 className="w-4 h-4" /> : state === 'wrong' ? <XCircle className="w-4 h-4" /> : String.fromCharCode(65 + k)}
                  </span>
                  <span className="[&_p]:my-0"><MathMarkdown>{o}</MathMarkdown></span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-muted/50 border border-border p-4">
              <p className={`text-[13px] font-bold mb-1 ${picked === answerIdx ? 'text-emerald-700' : 'text-rose-700'}`}>{picked === answerIdx ? 'Correct!' : 'Not quite'}</p>
              <div className="text-[14px] text-foreground leading-relaxed [&_p]:my-1"><MathMarkdown>{q.explanation}</MathMarkdown></div>
              <button onClick={next} className="mt-3 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5">
                {i + 1 >= questions.length ? 'See score' : 'Next'} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function TrueFalseView({ items, onComplete }: { items: TrueFalseItem[]; onComplete: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  const it = items[i];
  if (finished) {
    return (
      <div className="text-center py-8">
        <p className="font-heading text-2xl text-foreground">{right} / {items.length} correct</p>
        <button onClick={() => { setI(0); setPicked(null); setRight(0); setFinished(false); }} className="mt-5 h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Retry</button>
      </div>
    );
  }
  const choose = (v: boolean) => { if (picked !== null) return; setPicked(v); if (v === it.answer) setRight(r => r + 1); };
  return (
    <div className="max-w-xl mx-auto text-center">
      <p className="text-[12px] text-muted-foreground mb-4 tabular-nums">{i + 1} / {items.length}</p>
      <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] p-8 min-h-[160px] grid place-items-center text-[18px] font-medium text-foreground [&_p]:my-0">
        <MathMarkdown>{it.statement}</MathMarkdown>
      </motion.div>
      <div className="flex justify-center gap-3 mt-5">
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => choose(v)} disabled={picked !== null}
            className={`h-12 w-36 rounded-2xl border text-[15px] font-bold transition-colors ${
              picked === null ? 'border-border hover:border-primary/50 hover:bg-primary/5'
              : v === it.answer ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : picked === v ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-border opacity-50'}`}>
            {v ? 'True' : 'False'}
          </button>
        ))}
      </div>
      {picked !== null && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-left rounded-2xl bg-muted/50 border border-border p-4">
          <div className="text-[14px] leading-relaxed [&_p]:my-1"><MathMarkdown>{it.explanation}</MathMarkdown></div>
          <button onClick={() => { if (i + 1 >= items.length) { setFinished(true); onComplete(Math.round((right / items.length) * 100)); } else { setI(i + 1); setPicked(null); } }}
            className="mt-3 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5">
            {i + 1 >= items.length ? 'See score' : 'Next'} <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
