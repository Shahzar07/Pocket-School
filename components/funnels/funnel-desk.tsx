'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { flowNeighbor } from '@/lib/flow/steps';
import { FUNNEL_COPY as COPY } from '@/lib/funnels/copy';
import {
  emptySection,
  FUNNEL_STEPS,
  isFunnelStep,
  SECTION_KINDS,
  type FunnelItem,
  type FunnelLead,
  type FunnelRecord,
  type FunnelSection,
  type FunnelStepId,
  type FunnelSummary,
  type FunnelTemplate,
  type SectionKind,
} from '@/lib/funnels/model';
import { PublicFunnel } from '@/components/funnels/public-funnel';

const field = 'mt-1 min-h-11 w-full rounded-2xl border border-[#1E6A83]/20 bg-white px-3 text-sm text-[#203337] dark:border-[#3FE0D0]/30 dark:bg-[#0B1417] dark:text-[#E7F4F2]';
const button = 'inline-flex min-h-11 items-center rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337] disabled:opacity-40';
const quiet = 'inline-flex min-h-11 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] disabled:opacity-40 dark:border-[#3FE0D0] dark:text-[#3FE0D0]';

function patchItem(items: FunnelItem[], index: number, patch: Partial<FunnelItem>): FunnelItem[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

export function FunnelDesk() {
  const [step, setStep] = useState<FunnelStepId | 'list'>('list');
  const [rows, setRows] = useState<FunnelSummary[]>([]);
  const [funnel, setFunnel] = useState<FunnelRecord | null>(null);
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [sections, setSections] = useState<FunnelSection[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmTemplate, setConfirmTemplate] = useState<FunnelTemplate | null>(null);

  const apply = (next: FunnelRecord) => {
    setFunnel(next);
    setTitle(next.title);
    setSlug(next.slug);
    setSections(next.sections);
  };

  const refreshList = () => authedFetch('/api/funnels')
    .then((data) => setRows(Array.isArray(data.funnels) ? data.funnels as unknown as FunnelSummary[] : []))
    .catch((error: unknown) => setNote(error instanceof Error ? error.message : COPY.setup));

  const refreshOne = (id: string) => authedFetch(`/api/funnels?id=${encodeURIComponent(id)}`)
    .then((data) => {
      apply(data.funnel as unknown as FunnelRecord);
      setLeads(Array.isArray(data.leads) ? data.leads as unknown as FunnelLead[] : []);
    });

  useEffect(() => {
    refreshList().finally(() => setReady(true));
  }, []);

  const persist = async (current = funnel): Promise<FunnelRecord | null> => {
    if (!current) return null;
    const data = await authedFetch('/api/funnels', {
      method: 'POST',
      body: JSON.stringify({ action: 'save', id: current.id, title, slug, sections }),
    });
    const next = data.funnel as unknown as FunnelRecord;
    apply(next);
    return next;
  };

  const chooseTemplate = async (template: FunnelTemplate) => {
    setBusy(true);
    setNote('');
    try {
      if (funnel) {
        const data = await authedFetch('/api/funnels', {
          method: 'POST',
          body: JSON.stringify({ action: 'apply-template', id: funnel.id, template }),
        });
        apply(data.funnel as unknown as FunnelRecord);
        setNote(COPY.replacedDraft);
      } else {
        const data = await authedFetch('/api/funnels', {
          method: 'POST',
          body: JSON.stringify({ action: 'create', template }),
        });
        apply(data.funnel as unknown as FunnelRecord);
      }
      setConfirmTemplate(null);
      setStep('sections');
      await refreshList();
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    } finally {
      setBusy(false);
    }
  };

  const openRow = async (id: string) => {
    setBusy(true);
    setNote('');
    try {
      await refreshOne(id);
      setStep('sections');
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    } finally {
      setBusy(false);
    }
  };

  const go = async (next: FunnelStepId) => {
    setNote('');
    try {
      let current = funnel;
      if (funnel && (step === 'sections' || step === 'publish')) current = await persist() ?? funnel;
      if (next === 'publish' && current) await refreshOne(current.id);
      setStep(next);
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    }
  };

  const publish = async () => {
    if (!funnel) return;
    setBusy(true);
    setNote('');
    try {
      await persist();
      const data = await authedFetch('/api/funnels', {
        method: 'POST',
        body: JSON.stringify({ action: 'publish', id: funnel.id, slug }),
      });
      apply(data.funnel as unknown as FunnelRecord);
      await refreshOne(funnel.id);
      await refreshList();
      setNote(COPY.published);
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!funnel) return;
    setBusy(true);
    try {
      const data = await authedFetch('/api/funnels', {
        method: 'POST',
        body: JSON.stringify({ action: 'unpublish', id: funnel.id }),
      });
      apply(data.funnel as unknown as FunnelRecord);
      await refreshList();
      setNote(COPY.draft);
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    setNote('');
    try {
      const data = await authedFetch('/api/funnels', {
        method: 'POST',
        body: JSON.stringify({ action: 'duplicate', id }),
      });
      apply(data.funnel as unknown as FunnelRecord);
      setStep('sections');
      await refreshList();
    } catch (error) {
      setNote(error instanceof Error ? error.message : COPY.setup);
    } finally {
      setBusy(false);
    }
  };

  const updateSection = (id: string, patch: Partial<FunnelSection>) => {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  };

  const move = (index: number, direction: -1 | 1) => {
    setSections((current) => {
      const next = [...current];
      const target = index + direction;
      const row = next[index];
      const swap = next[target];
      if (!row || !swap) return current;
      next[index] = swap;
      next[target] = row;
      return next;
    });
  };

  if (!ready) {
    return <p data-funnel-desk="loading" className="p-6 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.opening}</p>;
  }

  return (
    <div data-funnel-desk="1" className="mx-auto flex min-h-[70vh] min-w-0 max-w-3xl flex-col gap-4 p-4 text-[#203337] dark:text-[#E7F4F2] sm:p-6">
      <header className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.brand}</p>
        <h1 className="font-heading text-3xl tracking-tight">{COPY.pageTitle}</h1>
        <p className="mt-1 text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.pageLede}</p>
      </header>
      {step !== 'list' ? (
        <FlowTrail
          steps={FUNNEL_STEPS}
          currentId={step}
          allowAhead={Boolean(funnel)}
          onSelect={(id) => { if (isFunnelStep(id)) void go(id); }}
        />
      ) : null}
      {note ? <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{note}</p> : null}

      {step === 'list' ? (
        <section className="grid gap-3">
          <button type="button" className={button} onClick={() => { setFunnel(null); setTitle(''); setSlug(''); setSections([]); setStep('template'); }}>{COPY.newPage}</button>
          {rows.length === 0 ? <p className="text-sm">{COPY.empty}</p> : null}
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1E6A83]/15 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.title}</p>
                  <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{row.status === 'published' ? COPY.published : COPY.draft}{row.slug ? ` · /p/${row.slug}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={quiet} onClick={() => void openRow(row.id)}>{COPY.open}</button>
                  <button type="button" className={quiet} disabled={busy} onClick={() => void duplicate(row.id)}>{COPY.duplicate}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 'template' ? (
        <section className="grid gap-3">
          {funnel ? <p className="text-sm">{COPY.replaceWarning}</p> : null}
          {(Object.keys(COPY.templates) as FunnelTemplate[]).map((template) => (
            <button
              key={template}
              type="button"
              className="rounded-[28px] border border-[#1E6A83]/15 p-4 text-left"
              disabled={busy}
              onClick={() => (funnel ? setConfirmTemplate(template) : void chooseTemplate(template))}
            >
              <span className="block font-semibold">{COPY.templates[template].title}</span>
              <span className="mt-1 block text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.templates[template].body}</span>
            </button>
          ))}
          {confirmTemplate ? (
            <button type="button" className={button} disabled={busy} onClick={() => void chooseTemplate(confirmTemplate)}>{COPY.confirmReplace}</button>
          ) : null}
        </section>
      ) : null}

      {step === 'sections' && funnel ? (
        <section className="grid gap-4">
          <label className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
            {COPY.titleLabel}
            <input className={field} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
          </label>
          {sections.map((section, index) => (
            <fieldset key={section.id} className="grid gap-2 rounded-[28px] border border-[#1E6A83]/15 p-4">
              <legend className="px-1 text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.kinds[section.kind]}</legend>
              <label className="text-sm font-semibold">
                {COPY.headingLabel}
                <input className={field} value={section.heading} maxLength={120} onChange={(event) => updateSection(section.id, { heading: event.target.value })} />
              </label>
              {section.kind === 'hero' ? (
                <>
                  <label className="text-sm font-semibold">
                    {COPY.ledeLabel}
                    <textarea className={field} rows={3} maxLength={400} value={section.lede} onChange={(event) => updateSection(section.id, { lede: event.target.value })} />
                  </label>
                  <label className="text-sm font-semibold">
                    {COPY.buttonLabel}
                    <input className={field} maxLength={40} value={section.button} onChange={(event) => updateSection(section.id, { button: event.target.value })} />
                  </label>
                </>
              ) : null}
              {section.kind === 'cta' ? (
                <>
                  <label className="text-sm font-semibold">
                    {COPY.bodyLabel}
                    <textarea className={field} rows={3} maxLength={500} value={section.body} onChange={(event) => updateSection(section.id, { body: event.target.value })} />
                  </label>
                  <label className="text-sm font-semibold">
                    {COPY.buttonLabel}
                    <input className={field} maxLength={40} value={section.button} onChange={(event) => updateSection(section.id, { button: event.target.value })} />
                  </label>
                </>
              ) : null}
              {section.kind === 'testimonials' ? <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.quotePlaceholder}</p> : null}
              {section.kind === 'pricing' ? <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.planNote}</p> : null}
              {section.kind === 'benefits' || section.kind === 'faq' || section.kind === 'pricing' ? (
                <div className="grid gap-2">
                  {section.items.map((item, itemIndex) => (
                    <div key={`${section.id}-${itemIndex}`} className="grid gap-2 rounded-2xl border border-[#1E6A83]/10 p-3">
                      <label className="text-sm font-semibold">
                        {section.kind === 'faq' ? COPY.questionLabel : COPY.itemTitle}
                        <input className={field} maxLength={80} value={item.title} onChange={(event) => updateSection(section.id, { items: patchItem(section.items, itemIndex, { title: event.target.value }) })} />
                      </label>
                      {section.kind === 'pricing' ? (
                        <label className="text-sm font-semibold">
                          {COPY.priceLabel}
                          <input className={field} maxLength={40} value={item.price} onChange={(event) => updateSection(section.id, { items: patchItem(section.items, itemIndex, { price: event.target.value }) })} />
                        </label>
                      ) : null}
                      <label className="text-sm font-semibold">
                        {section.kind === 'faq' ? COPY.answerLabel : COPY.bodyLabel}
                        <textarea className={field} rows={2} maxLength={400} value={item.body} onChange={(event) => updateSection(section.id, { items: patchItem(section.items, itemIndex, { body: event.target.value }) })} />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={quiet}
                    disabled={section.items.length >= 8}
                    onClick={() => updateSection(section.id, { items: [...section.items, { title: '', body: '', price: '' }] })}
                  >
                    {COPY.addItem}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={quiet} disabled={index === 0} onClick={() => move(index, -1)}>{COPY.moveUp}</button>
                <button type="button" className={quiet} disabled={index === sections.length - 1} onClick={() => move(index, 1)}>{COPY.moveDown}</button>
                <button type="button" className={quiet} onClick={() => setSections((current) => current.filter((row) => row.id !== section.id))}>{COPY.remove}</button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-sm font-semibold">{COPY.addSection}</p>
            {SECTION_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={quiet}
                disabled={sections.length >= 12}
                onClick={() => setSections((current) => [...current, emptySection(kind, `${kind}-${current.length + 1}-${Date.now()}`)])}
              >
                {COPY.kinds[kind]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'preview' && funnel ? (
        <PublicFunnel funnel={{ title, slug, sections }} mode="preview" />
      ) : null}

      {step === 'publish' && funnel ? (
        <section className="grid gap-3">
          <p data-funnel-status={funnel.status} className="text-sm">{funnel.status === 'published' ? COPY.published : COPY.draft}</p>
          <label className="text-sm font-semibold text-[#1E6A83] dark:text-[#3FE0D0]">
            {COPY.slugLabel}
            <input className={field} value={slug} maxLength={48} onChange={(event) => setSlug(event.target.value)} />
          </label>
          <p className="text-sm text-[#1E6A83] dark:text-[#3FE0D0]">{COPY.slugHint}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy} onClick={() => void publish()}>{COPY.publish}</button>
            <button type="button" className={quiet} disabled={busy || funnel.status !== 'published'} onClick={() => void unpublish()}>{COPY.unpublish}</button>
            <button type="button" className={quiet} disabled={busy} onClick={() => void duplicate(funnel.id)}>{COPY.duplicate}</button>
          </div>
          {funnel.status === 'published' && funnel.slug ? (
            <a className="text-sm font-semibold text-[#1E6A83] underline dark:text-[#3FE0D0]" href={`/p/${funnel.slug}`}>{COPY.publicLink}</a>
          ) : null}
          <h2 className="font-heading text-2xl">{COPY.leadsTitle}</h2>
          {leads.length === 0 ? <p className="text-sm">{COPY.leadsEmpty}</p> : (
            <ul className="grid gap-2">
              {leads.map((lead) => (
                <li key={lead.id} data-funnel-lead={lead.email} className="rounded-2xl border border-[#1E6A83]/15 p-3 text-sm">
                  <p className="font-semibold">{lead.name}</p>
                  <p className="text-[#1E6A83] dark:text-[#3FE0D0]">{lead.email}</p>
                  {lead.note ? <p className="mt-1">{lead.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step !== 'list' ? (
        <FlowNav
          backLabel={step === 'template' ? COPY.backToList : undefined}
          backDisabled={false}
          nextDisabled={step === 'publish' || (step === 'template' && !funnel) || busy}
          onBack={() => {
            if (step === 'template') {
              setStep('list');
              void refreshList();
              return;
            }
            const previous = flowNeighbor(FUNNEL_STEPS, step, -1);
            if (previous && isFunnelStep(previous.id)) void go(previous.id);
          }}
          onNext={() => {
            const next = flowNeighbor(FUNNEL_STEPS, step, 1);
            if (next && isFunnelStep(next.id)) void go(next.id);
          }}
        />
      ) : null}
    </div>
  );
}
