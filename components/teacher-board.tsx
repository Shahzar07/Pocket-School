'use client';

import { useState } from 'react';
import { CheckCircle2, ClipboardList, Lightbulb, PenSquare, XCircle } from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';
import { correctIndex } from '@/lib/quiz-answer';
import { optionId, optionIndex } from '@/lib/quiz';
import type { ProblemItem, QuizItem } from '@/lib/teacher-chat';

export function QuizCard({ item, accent, onAnswer }: { item: QuizItem; accent: string; onAnswer: (id: number, option: string) => void }) {
  const answered = !!item.chosen;
  const answerIdx = correctIndex(item.options, item.answer);
  const storedIndex = optionIndex(item.chosen, item.options.length);
  const picked = storedIndex >= 0 ? storedIndex : (item.chosen ? item.options.indexOf(item.chosen) : -1);
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <ClipboardList className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Quiz</span>
        {answered && (picked === answerIdx
          ? <span className="text-[10px] font-bold text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Correct</span>
          : <span className="text-[10px] font-bold text-[var(--ps-tile-ink)] flex items-center gap-1"><XCircle className="w-3 h-3" /> Not quite</span>)}
      </div>
      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 mb-3"><MathMarkdown>{item.question}</MathMarkdown></div>
      <div className="space-y-1.5" role="group" aria-label="Quiz options">
        {item.options.map((option, index) => {
          const chosen = picked === index;
          const right = index === answerIdx;
          const showState = answered && (chosen || right);
          return (
            <button key={optionId(index)} type="button" onClick={() => !answered && onAnswer(item.id, optionId(index))} disabled={answered}
              aria-pressed={chosen}
              className={`w-full text-start min-h-11 text-sm rounded-xl px-3 py-2 border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                showState
                  ? right ? 'border-success/60 bg-success/10 text-success' : 'border-[var(--ps-cyan-border)] bg-[var(--ps-tile-wash)] text-[var(--ps-tile-ink)]'
                  : 'border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30'
              }`}>
              {String.fromCharCode(65 + index)}. {option}
            </button>
          );
        })}
      </div>
      {answered && item.explanation && (
        <p className="mt-3 text-xs text-white/60 italic border-l-2 pl-3" style={{ borderColor: accent }}>{item.explanation}</p>
      )}
    </div>
  );
}

export function ProblemCard({ item, accent, onCheck }: { item: ProblemItem; accent: string; onCheck: (id: number, answer: string) => void }) {
  const [answer, setAnswer] = useState('');
  const [hintShown, setHintShown] = useState(false);
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <PenSquare className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Practice problem</span>
        {item.submitted && <span className="text-[10px] font-bold text-sky-300">Checking in chat</span>}
      </div>
      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 mb-3"><MathMarkdown>{item.prompt}</MathMarkdown></div>
      <textarea
        value={answer}
        onChange={event => setAnswer(event.target.value)}
        aria-label="Your answer"
        placeholder="Write your answer here"
        rows={2}
        className="w-full resize-none rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/25 placeholder:text-white/25"
      />
      <div className="flex items-center gap-2 mt-2.5">
        <button type="button" onClick={() => onCheck(item.id, answer)} disabled={!answer.trim()}
          className="text-xs font-bold px-4 py-2 rounded-full text-black disabled:opacity-40" style={{ background: accent }}>
          Check my answer
        </button>
        {item.hint && (
          <button type="button" onClick={() => setHintShown(shown => !shown)} className="text-[11px] font-semibold text-white/50 hover:text-white flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" /> {hintShown ? 'Hide hint' : 'Hint'}
          </button>
        )}
      </div>
      {hintShown && item.hint && <p className="mt-2 text-xs text-[var(--ps-cyan-text)]/80 border-l-2 border-[var(--ps-cyan-border)]/50 pl-3">{item.hint}</p>}
    </div>
  );
}
