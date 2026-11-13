'use client';

import { pageForPath } from '@/lib/dashboard-pages';

/** Short “what this page is for” line, shared by every dashboard route. */
export function PagePurpose({ pathname }: { pathname: string }) {
  const page = pageForPath(pathname);
  if (!page || page.title.includes('(retired)')) return null;
  return (
    <details
      aria-label="What this page is for"
      className="group mb-3 w-fit max-w-full rounded-2xl border border-border bg-card/80 text-sm open:w-full"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold">i</span>
        What this page is for
      </summary>
      <p className="px-3 pb-3 leading-relaxed text-foreground">{page.purpose}</p>
    </details>
  );
}
