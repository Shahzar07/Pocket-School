import type { ReactNode } from 'react';
import Link from 'next/link';

/** Cream card used by academy registration, the admin door, and pending approval. */
export function InstitutionJourneyFrame({
  eyebrow,
  title,
  lede,
  children,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
  /** Start keeps a long form at the top of the page. */
  align?: 'center' | 'start';
}) {
  const column = align === 'start'
    ? 'mx-auto flex max-w-xl flex-col px-5 py-12'
    : 'mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-12';
  return (
    <main className="min-h-screen bg-[#F6F1E7] text-[#1A3C34]">
      <div className={column}>
        <p className="mb-4 text-sm font-semibold">
          <Link href="/" className="underline decoration-[#C8922A] underline-offset-4">Poket School</Link>
        </p>
        <section className="rounded-[28px] border border-[#1A3C34]/10 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(26,60,52,0.45)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8922A]">{eyebrow}</p>
          <h1 className="mt-2 font-heading text-3xl tracking-tight">{title}</h1>
          {lede && <p className="mt-2 text-sm leading-relaxed text-[#1A3C34]/75">{lede}</p>}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

export const journeyField = 'mt-1 h-11 w-full rounded-xl border border-[#1A3C34]/15 bg-white px-3 text-sm text-[#1A3C34] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8922A]';

export const journeyButton = 'inline-flex h-11 items-center justify-center rounded-full bg-[#1A3C34] px-5 text-sm font-semibold text-white disabled:opacity-60';
