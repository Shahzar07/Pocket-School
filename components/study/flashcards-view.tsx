'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Check, X, Shuffle } from 'lucide-react';
import { MathMarkdown } from '@/components/math-markdown';
import type { Flashcard } from '@/lib/study/types';

/**
 * Flip, then say honestly whether you knew it. Cards you didn't know come
 * back round until you do — the score is the share known first time.
 */
export function FlashcardsView({ cards, onComplete }: { cards: Flashcard[]; onComplete: (score: number) => void }) {
  const [queue, setQueue] = useState<number[]>(() => cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState(false);
  const current = queue[0];

  const answer = (knew: boolean) => {
    setFirstTry(f => (current in f ? f : { ...f, [current]: knew }));
    setFlipped(false);
    setQueue(q => {
      const rest = q.slice(1);
      return knew ? rest : [...rest, current];
    });
  };

  useEffect(() => {
    if (queue.length === 0 && !done) {
      setDone(true);
      const known = Object.values(firstTry).filter(Boolean).length;
      onComplete(Math.round((known / Math.max(1, cards.length)) * 100));
    }
  }, [queue.length, done, firstTry, cards.length, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      if (flipped && e.key === 'ArrowRight') answer(true);
      if (flipped && e.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done) {
    const known = Object.values(firstTry).filter(Boolean).length;
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-2">🧠</p>
        <p className="font-heading text-2xl text-foreground">{known} of {cards.length} known first time</p>
        <p className="text-sm text-muted-foreground mt-1">Every card was cleared. Review again in a couple of days to lock it in.</p>
        <button onClick={() => { setQueue(cards.map((_, i) => i)); setFirstTry({}); setDone(false); }}
          className="mt-5 h-10 px-4 rounded-full border border-border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Go again</button>
      </div>
    );
  }

  const card = cards[current];
  const progress = cards.length - queue.length;
  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-3">
        <span className="tabular-nums">{progress} / {cards.length} cleared</span>
        <button onClick={() => setQueue(q => [...q].sort(() => Math.random() - 0.5))} className="inline-flex items-center gap-1 hover:text-foreground"><Shuffle className="w-3.5 h-3.5" /> Shuffle</button>
      </div>
      <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(progress / cards.length) * 100}%` }} /></div>
      <div className="[perspective:1200px]">
        <AnimatePresence mode="wait">
          <motion.button
            key={`${current}-${queue.length}`}
            onClick={() => setFlipped(f => !f)}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, rotateY: flipped ? 180 : 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ rotateY: { duration: 0.45 }, default: { duration: 0.2 } }}
            className="relative w-full min-h-[240px] [transform-style:preserve-3d]"
            aria-label="Flip card"
          >
            <span className="absolute inset-0 rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] p-8 grid place-items-center text-center [backface-visibility:hidden]">
              <span className="text-[19px] font-medium text-foreground leading-snug [&_p]:my-0"><MathMarkdown>{card.front}</MathMarkdown></span>
              <span className="absolute bottom-4 text-[11px] text-muted-foreground">Tap or press space to flip</span>
            </span>
            <span className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/[0.04] p-8 grid place-items-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-[16px] text-foreground leading-relaxed [&_p]:my-0"><MathMarkdown>{card.back}</MathMarkdown></span>
            </span>
          </motion.button>
        </AnimatePresence>
      </div>
      <div className={`flex justify-center gap-3 mt-5 transition-opacity ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={() => answer(false)} className="h-11 px-5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-sm inline-flex items-center gap-1.5"><X className="w-4 h-4" /> Still learning</button>
        <button onClick={() => answer(true)} className="h-11 px-5 rounded-full border border-success/40 bg-success/15 text-success font-semibold text-sm inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Knew it</button>
      </div>
    </div>
  );
}
