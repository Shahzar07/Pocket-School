'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BOOKS } from '@/lib/reads/seed';
import type { Book, BookStatus } from '@/lib/reads/types';
import { useReadsT } from '@/lib/reads/i18n';
import { getLanguage } from '@/lib/languages';
import { planLabel } from '@/lib/reads/access';

export function StudioView() {
  const t = useReadsT();
  const [books, setBooks] = useState<Book[]>(() => BOOKS.map(b => ({ ...b, chapters: b.chapters.map(c => ({ ...c })) })));
  const [id, setId] = useState('monsoon-market');
  const book = books.find(b => b.id === id) ?? books[0];

  const update = (patch: Partial<Book>) => {
    setBooks(list => list.map(b => b.id === book.id ? { ...b, ...patch } : b));
    toast.success(t('reads.studio.savedLocal'));
  };

  const setStatus = (status: BookStatus) => {
    if (book.status === 'draft' && status === 'published') return;
    if (book.status === 'published' && status === 'draft') return;
    update({ status, version: status === 'published' ? book.version + 1 : book.version });
  };

  const generate = async () => {
    try {
      const res = await fetch('/api/reads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'outline',
          title: book.title,
          category: book.category,
          form: book.form,
          genre: book.genre,
          ageRating: book.ageRating,
          readingLevel: book.readingLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('reads.studio.generateFail'));
      update({ blurb: data.blurb || book.blurb, title: data.title || book.title });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reads.studio.generateFail'));
    }
  };

  const counts = useMemo(() => ({
    draft: books.filter(b => b.status === 'draft').length,
    review: books.filter(b => b.status === 'review').length,
    published: books.filter(b => b.status === 'published').length,
  }), [books]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-[40px] tracking-[-0.04em] sm:text-[52px]">{t('reads.studio.title')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('reads.studio.lead')}</p>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">{t('reads.studio.preview')}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <p className="px-1 text-[12px] text-muted-foreground">{counts.draft} {t('reads.studio.draft')} · {counts.review} {t('reads.studio.review')} · {counts.published} {t('reads.studio.published')}</p>
          {books.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setId(item.id)}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${item.id === book.id ? 'border-[#203337] bg-card' : 'border-border'}`}
            >
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{item.status}</span>
            </button>
          ))}
        </aside>
        <section className="space-y-5 rounded-[28px] border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Step active={book.status === 'draft'} label={t('reads.studio.draft')} />
            <Step active={book.status === 'review'} label={t('reads.studio.review')} />
            <Step active={book.status === 'published'} label={t('reads.studio.published')} />
          </div>
          <label className="block text-sm font-semibold">{t('reads.studio.fieldTitle')}
            <input value={book.title} onChange={e => update({ title: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal" />
          </label>
          <label className="block text-sm font-semibold">{t('reads.studio.fieldBlurb')}
            <textarea value={book.blurb} onChange={e => update({ blurb: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">{t('reads.studio.price')}
              <input type="number" value={book.priceRM} onChange={e => update({ priceRM: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal" />
            </label>
            <label className="text-sm font-semibold">{t('reads.studio.tier')}
              <input type="number" min={0} max={6} value={book.minTier} onChange={e => update({ minTier: Number(e.target.value) as Book['minTier'] })} className="mt-1 h-11 w-full rounded-xl border border-border px-3 font-normal" />
              <span className="mt-1 block font-normal text-muted-foreground">{planLabel(book.minTier)}</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={book.allocateLibrary} onChange={e => update({ allocateLibrary: e.target.checked })} />{t('reads.studio.library')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={book.allocateMarketplace} onChange={e => update({ allocateMarketplace: e.target.checked })} />{t('reads.studio.market')}</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generate} className="h-10 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground">{t('reads.studio.generate')}</button>
            {book.status === 'draft' && <button type="button" onClick={() => setStatus('review')} className="h-10 rounded-full bg-[#203337] px-4 text-sm font-bold text-white">{t('reads.studio.toReview')}</button>}
            {book.status === 'review' && <button type="button" onClick={() => setStatus('published')} className="h-10 rounded-full bg-[#203337] px-4 text-sm font-bold text-white">{t('reads.studio.publish')}</button>}
            {book.status === 'review' && <button type="button" onClick={() => setStatus('draft')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">{t('reads.studio.back')}</button>}
            {book.status === 'published' && <button type="button" onClick={() => setStatus('review')} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">{t('reads.studio.unpublish')}</button>}
          </div>
          <div>
            <h2 className="font-heading text-[22px]">{t('reads.studio.chapters')}</h2>
            <ol className="mt-2 space-y-2">
              {book.chapters.map((chapter, index) => (
                <li key={chapter.id} className="rounded-xl border border-border p-3 text-sm">
                  <span className="font-semibold">{index + 1}. {chapter.title}</span>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{chapter.markdown}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-heading text-[22px]">{t('reads.studio.languages')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('reads.studio.languagesLead')}</p>
            <ul className="mt-3 space-y-2">
              {(book.languageVersions ?? []).map(version => (
                <li key={version.language} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span>
                    <strong>{getLanguage(version.language).label}</strong>
                    <span className="ml-2 text-muted-foreground">{version.status} · v{version.sourceVersion}{version.aiTranslated ? ' · AI' : ''}</span>
                  </span>
                  {version.status !== 'approved' && (
                    <button
                      type="button"
                      className="h-9 rounded-full bg-secondary px-3 text-[12px] font-bold"
                      onClick={() => update({
                        languageVersions: (book.languageVersions ?? []).map(v => v.language === version.language ? { ...v, status: 'approved' } : v),
                      })}
                    >
                      {t('reads.studio.approve')}
                    </button>
                  )}
                </li>
              ))}
              {(book.languageVersions ?? []).length === 0 && <li className="text-sm text-muted-foreground">{t('reads.studio.source')}</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({ active, label }: { active: boolean; label: string }) {
  return <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${active ? 'bg-[#203337] text-white' : 'bg-muted text-muted-foreground'}`}>{label}</span>;
}
