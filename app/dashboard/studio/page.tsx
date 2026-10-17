'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PenLine } from 'lucide-react';
import { DashPage } from '@/components/dash-ui';
import { StudioToolGrid } from '@/components/studio/hub-tools';
import { essayLevelLabel } from '@/lib/essays/coaching';
import { readEssays, statusText, type StoredEssay } from '@/lib/essays/store';
import { STUDIO_ET } from '@/lib/studio-paths';

const HERO =
  'radial-gradient(ellipse at 100% 0%, rgba(226,175,77,0.42), transparent 42%), linear-gradient(145deg, #143E4E 0%, #1E6A83 62%, #18556A 100%)';

const PROMPTS = [
  { label: 'Video on photosynthesis', q: 'Make a video on photosynthesis' },
  { label: 'Quiz on the French Revolution', q: 'Quiz me on the French Revolution' },
  { label: 'Explain quadratic equations', q: 'Can you explain how to solve quadratic equations?' },
  { label: 'Flashcards for the periodic table', q: 'Flashcards for the first 20 elements of the periodic table' },
];

export default function StudioHub() {
  const reduce = useReducedMotion();
  const [essays, setEssays] = useState<StoredEssay[] | null>(null);

  useEffect(() => {
    const items = readEssays().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    setEssays(items);
  }, []);

  return (
    <DashPage>
      <motion.section
        data-testid="studio-hero"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.21, 0.6, 0.35, 1] }}
        className="relative overflow-hidden rounded-3xl px-6 py-8 text-white sm:px-10 sm:py-10"
        style={{ background: HERO }}
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white">Poket School</p>
        <h1 className="mt-3 max-w-xl font-heading text-[34px] leading-[1.05] tracking-[-0.04em] text-white sm:text-[46px]">
          What should ET AI make today?
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white">
          Lessons, maths, exams, essays and books, plus teacher, parent, and research tools when your role allows them.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <Link
              key={prompt.label}
              href={`${STUDIO_ET}?q=${encodeURIComponent(prompt.q)}`}
              className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1E6A83] transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
            >
              {prompt.label}
            </Link>
          ))}
        </div>
      </motion.section>

      <StudioToolGrid />

      <section aria-labelledby="recent-work-heading" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-work-heading" className="font-heading text-[26px] tracking-[-0.03em] text-foreground">Recent work</h2>
            <p className="mt-1 text-sm text-muted-foreground">Essays you have started on this device.</p>
          </div>
          <Link href="/dashboard/studio/essays" className="text-sm font-semibold text-[#1E6A83] hover:underline dark:text-[#A7D9E5]">
            Open ET Essays
          </Link>
        </div>
        {essays === null ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
        ) : essays.length === 0 ? (
          <div data-testid="studio-recent-empty" className="mt-4 rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F3EEF8] text-[#5B3D8A] dark:bg-[#241C30] dark:text-[#D4C4EE]">
              <PenLine className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 font-heading text-[22px] tracking-[-0.03em] text-foreground">Nothing saved here yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Ask ET AI for a question, plan the essay, and write it yourself. It will show up in this strip.
            </p>
            <Link
              href="/dashboard/studio/essays"
              className="mt-5 inline-flex h-10 items-center rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white dark:bg-[#6FBBCE] dark:text-[#0B1417]"
            >
              Start with ET Essays
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {essays.map((essay) => (
              <li key={essay.id}>
                <Link
                  href="/dashboard/studio/essays"
                  className="flex h-full flex-col rounded-xl border border-border bg-background px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B3D8A] dark:text-[#D4C4EE]">
                    {essayLevelLabel(essay.level)}
                  </span>
                  <span className="mt-1 font-semibold text-foreground">{essay.title}</span>
                  <span className="mt-1 text-sm text-muted-foreground">{statusText(essay)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashPage>
  );
}
