'use client';

import { useEffect, useState } from 'react';
import { FUNNEL_COPY as COPY } from '@/lib/funnels/copy';
import type { FunnelSection, PublicFunnel as PublicFunnelView } from '@/lib/funnels/model';

const card = 'rounded-[28px] border border-[#1E6A83]/15 bg-white p-6 text-[#203337] dark:bg-[#1A1918] dark:text-[#E7F4F2]';
const field = 'mt-1 min-h-11 w-full rounded-2xl border border-[#1E6A83]/20 bg-white px-3 text-sm text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2]';
const button = 'inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-40';

function Items({ section }: { section: FunnelSection }) {
  if (section.kind === 'pricing') {
    return (
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {section.items.map((item, index) => (
          <li key={`${section.id}-${index}`} className="rounded-2xl border border-[#1E6A83]/15 p-4">
            <p className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{item.title}</p>
            {item.price ? <p className="mt-1 font-heading text-3xl">{item.price}</p> : null}
            {item.body ? <p className="mt-2 text-sm leading-relaxed">{item.body}</p> : null}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="mt-4 space-y-3">
      {section.items.map((item, index) => (
        <li key={`${section.id}-${index}`}>
          <p className="text-sm font-semibold">{item.title}</p>
          {item.body ? <p className="mt-1 text-sm leading-relaxed text-[#1E6A83] dark:text-[#3FE0D0]">{item.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function LeadForm({ slug, mode }: { slug: string; mode: 'public' | 'preview' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (mode === 'preview') {
    return <p className="mt-4 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.previewForm}</p>;
  }
  if (sent) return <p className="mt-4 text-sm">{COPY.leadSent}</p>;
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        fetch('/api/funnels/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, name, email, note }),
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : COPY.leadFailed);
            setSent(true);
          })
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : COPY.leadFailed))
          .finally(() => setBusy(false));
      }}
    >
      <label className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
        {COPY.leadName}
        <input className={field} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
        {COPY.leadEmail}
        <input className={field} type="email" value={email} maxLength={120} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
        {COPY.leadNote}
        <textarea className={field} value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{error}</p> : null}
      <button type="submit" className={button} disabled={busy}>{COPY.leadSend}</button>
    </form>
  );
}

export function PublicFunnel({
  funnel,
  mode,
}: {
  funnel: PublicFunnelView;
  mode: 'public' | 'preview';
}) {
  const hero = funnel.sections.find((section) => section.kind === 'hero');
  const [live, setLive] = useState(false);
  useEffect(() => { setLive(true); }, []);
  return (
    <main data-funnel-public={mode} data-funnel-live={live ? '1' : '0'} className="min-h-screen overflow-x-clip bg-[#F4FBFA] px-4 py-10 text-[#203337] dark:bg-[#0B1417] dark:text-[#E7F4F2] sm:px-6">
      <article className="mx-auto grid min-w-0 max-w-3xl gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.brand}</p>
        {mode === 'preview' ? <p className="rounded-2xl bg-[#203337] px-4 py-3 text-sm text-white">{COPY.previewBanner}</p> : null}
        <h1 className="font-heading text-4xl tracking-tight sm:text-5xl">{hero?.heading || funnel.title}</h1>
        {funnel.sections.map((section) => {
          if (section.kind === 'hero') {
            return (
              <section key={section.id} className={card}>
                {section.lede ? <p className="text-base leading-relaxed">{section.lede}</p> : null}
                {section.button ? <p className="mt-4"><span className={button}>{section.button}</span></p> : null}
              </section>
            );
          }
          if (section.kind === 'testimonials') {
            return (
              <section key={section.id} className={card}>
                <h2 className="font-heading text-2xl">{section.heading}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.quotePlaceholder}</p>
              </section>
            );
          }
          if (section.kind === 'cta') {
            return (
              <section key={section.id} className={card}>
                <h2 className="font-heading text-2xl">{section.heading}</h2>
                {section.body ? <p className="mt-3 text-sm leading-relaxed">{section.body}</p> : null}
                <LeadForm slug={funnel.slug} mode={mode} />
              </section>
            );
          }
          return (
            <section key={section.id} className={card}>
              <h2 className="font-heading text-2xl">{section.heading}</h2>
              {section.body ? <p className="mt-3 text-sm leading-relaxed">{section.body}</p> : null}
              <Items section={section} />
            </section>
          );
        })}
      </article>
    </main>
  );
}
