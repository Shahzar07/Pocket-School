'use client';

import { useParams } from 'next/navigation';
import { useWhiteLabel } from '@/components/white-label-provider';

export default function AcademyPage() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const { institution, branding, resolving } = useWhiteLabel();
  if (resolving) return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-muted-foreground">Loading the academy…</div>;
  if (!institution) return <div className="mx-auto max-w-3xl px-4 py-16">Open this page from an academy address.</div>;
  const page = (institution.publishedPages ?? []).find((item) => item.slug === pageSlug);
  if (!page || institution.features?.customPages === false) {
    return <div className="mx-auto max-w-3xl px-4 py-16">{branding.displayName} has not published that page.</div>;
  }
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{branding.displayName}</p>
      <h1 className="font-heading text-4xl">{page.title}</h1>
      <div className="whitespace-pre-wrap text-sm leading-6">{page.body}</div>
    </article>
  );
}
