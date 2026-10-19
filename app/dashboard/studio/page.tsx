'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine } from 'lucide-react';
import { StudioToolGrid } from '@/components/studio/hub-tools';
import { essayLevelLabel } from '@/lib/essays/coaching';
import { readEssays, statusText, type StoredEssay } from '@/lib/essays/store';
import { STUDIO_ET } from '@/lib/studio-paths';
import { HUB_COPY } from '@/lib/studio/hub-copy';
import { useAuthSTORE } from '@/hooks/use-auth';

const PROMPTS = [
  { label: 'Video on photosynthesis', q: 'Make a video on photosynthesis' },
  { label: 'Quiz on the French Revolution', q: 'Quiz me on the French Revolution' },
  { label: 'Explain quadratic equations', q: 'Can you explain how to solve quadratic equations?' },
  { label: 'Flashcards for the periodic table', q: 'Flashcards for the first 20 elements of the periodic table' },
];

export default function StudioHub() {
  const router = useRouter();
  const { profile, user } = useAuthSTORE();
  const first = (profile?.displayName || profile?.name || user?.displayName || '').trim().split(' ')[0];
  const [essays, setEssays] = useState<StoredEssay[] | null>(null);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const items = readEssays().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    setEssays(items);
  }, []);

  const ask = (value: string) => {
    const text = value.trim();
    if (!text) return;
    router.push(`${STUDIO_ET}?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 py-8 text-center" data-testid="studio-hero" data-studio-home="astra">
      <p className="text-3xl font-semibold tracking-tight text-[#203337] sm:text-4xl">
        {first ? `${HUB_COPY.hello} ${first}, ` : ''}{HUB_COPY.greeting}
      </p>
      <form
        className="mt-8 flex w-full items-center gap-2 rounded-full border border-[#1E6A83]/30 bg-white px-3 py-2 shadow-sm"
        onSubmit={(event) => { event.preventDefault(); ask(prompt); }}
      >
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={HUB_COPY.prompt}
          aria-label={HUB_COPY.prompt}
          className="min-h-11 flex-1 bg-transparent text-left text-sm outline-none"
        />
        <button type="submit" className="min-h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]">
          {HUB_COPY.send}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {PROMPTS.map((item) => (
          <button
            key={item.q}
            type="button"
            onClick={() => ask(item.q)}
            className="rounded-full border border-[#1E6A83]/20 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1E6A83]"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-10 w-full text-left">
        <StudioToolGrid />
      </div>
      <section aria-labelledby="recent-work-heading" className="mt-8 w-full text-left">
        <div className="flex items-end justify-between gap-3">
          <h2 id="recent-work-heading" className="text-lg font-semibold text-[#203337]">{HUB_COPY.recent}</h2>
          <Link href="/dashboard/studio/essays" className="text-sm font-semibold text-[#1E6A83]">{HUB_COPY.essays}</Link>
        </div>
        {essays === null ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
        ) : essays.length === 0 ? (
          <div data-testid="studio-recent-empty" className="mt-4 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
            <PenLine className="mx-auto h-6 w-6 text-[#1E6A83]" aria-hidden />
            <p className="mt-3 text-sm text-[#1E6A83]">{HUB_COPY.empty}</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {essays.map((essay) => (
              <li key={essay.id}>
                <Link href="/dashboard/studio/essays" className="block rounded-xl border border-border bg-white px-4 py-3 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1E6A83]">{essayLevelLabel(essay.level)}</span>
                  <span className="mt-1 block font-semibold">{essay.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{statusText(essay)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
