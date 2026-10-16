'use client';

import { pageForPath } from '@/lib/dashboard-pages';

/** Short “what this page is for” line, shared by every dashboard route. */
export function PagePurpose({ pathname }: { pathname: string }) {
  const page = pageForPath(pathname);
  if (!page || page.title.includes('(retired)')) return null;
  return (
    <section
      aria-label="What this page is for"
      className="mb-4 rounded-2xl border border-border bg-card/80 px-4 py-3"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">What this page is for</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{page.purpose}</p>
    </section>
  );
}
