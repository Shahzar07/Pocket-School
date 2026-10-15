'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BookCover } from '@/components/shelf/book-cover';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { ShelfRow } from '@/components/shelf/ui';
import { courseToShelf, relatedCoursesForBook, seedCourseViews } from '@/lib/shelf/catalogue';
import { SAMPLE_OWNED, SAMPLE_READER, checkBookAccess, planLabel } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';
import { bookById, publishedBooks } from '@/lib/reads/seed';
import { formatMoney } from '@/lib/shelf/money';
import { myList, toggleList } from '@/lib/shelf/storage';
import { getLanguage } from '@/lib/languages';

export function BookDetail({ bookId }: { bookId: string }) {
  const t = useReadsT();
  const book = bookById(bookId);
  const { profile, ready } = useShelfProfile();
  const [list, setList] = useState<string[]>([]);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    if (!ready) return;
    setList(myList(profile.id));
  }, [ready, profile.id]);

  if (!book || book.status !== 'published') {
    return <p className="text-sm text-muted-foreground">This book is not on the shelf.</p>;
  }

  const version = book.languageVersions?.find(v => v.language === lang);
  const title = version?.title ?? book.title;
  const blurb = version?.blurb ?? book.blurb;
  const preview = version?.chapters[0]?.markdown ?? book.chapters[0]?.markdown ?? '';
  const access = checkBookAccess(book, SAMPLE_READER, { ownedIds: SAMPLE_OWNED });
  const price = formatMoney(book.priceRM, 'MYR');
  const courses = relatedCoursesForBook(book, seedCourseViews()).map(c => courseToShelf(c));
  const seriesMates = publishedBooks().filter(b => b.series?.id && b.series.id === book.series?.id && b.id !== book.id);

  return (
    <article className="space-y-8">
      <div className="grid items-start gap-8 lg:grid-cols-[280px_1fr]">
        <BookCover title={title} cover={book.cover} className="aspect-[2/3] w-full max-w-[280px] rounded-xl shadow-[var(--shadow-card-hover)]" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{book.genre} · {t('reads.detail.by')}</p>
          <h1 className="mt-2 font-heading text-[42px] leading-[0.98] tracking-[-0.04em] sm:text-[56px]">{title}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{blurb}</p>
          <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <div>{t('reads.detail.age', { rating: book.ageRating })}</div>
            <div>{book.form === 'fiction' ? t('reads.filter.fiction') : t('reads.filter.nonfiction')}</div>
            <div>{book.category === 'academic' ? t('reads.filter.academic') : t('reads.filter.general')}</div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/reads/read/${book.id}?lang=${lang}`} className="inline-flex h-11 items-center rounded-full bg-[#203337] px-5 text-sm font-bold text-white">
              {access.allowed && access.source !== 'preview' ? t('reads.detail.read') : t('reads.detail.sample')}
            </Link>
            <button
              type="button"
              onClick={() => setList(toggleList(profile.id, book.id))}
              className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold"
            >
              {list.includes(book.id) ? t('reads.listed') : t('reads.myList')}
            </button>
          </div>
          <p className="mt-4 text-sm text-foreground">
            {access.allowed && access.source === 'owned' && t('reads.badge.owned')}
            {access.allowed && access.source === 'subscription' && `${t('reads.badge.included')} · ${planLabel(book.minTier)}`}
            {!access.allowed && access.reason === 'PURCHASE' && t('reads.detail.buy', { price })}
            {!access.allowed && access.reason === 'UPGRADE' && t('reads.detail.upgrade', { plan: planLabel(book.minTier) })}
          </p>
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t('reads.detail.languages')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <LangButton active={lang === 'en'} onClick={() => setLang('en')}>English</LangButton>
              {(book.languageVersions ?? []).map(v => (
                <LangButton key={v.language} active={lang === v.language} onClick={() => setLang(v.language)}>
                  {getLanguage(v.language).label}
                </LangButton>
              ))}
            </div>
            {version && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                {version.status === 'approved' ? t('reads.detail.versionApproved') : t('reads.detail.versionReview')}
                {version.sourceVersion !== book.version ? ` · ${t('reads.detail.versionStale')}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-[#F7F1E6] p-6 text-[#2C241C] sm:p-10">
        <h2 className="font-heading text-[28px]">{t('reads.detail.preview')}</h2>
        <p className="mt-1 text-sm opacity-70">{book.chapters[0]?.title}</p>
        <div className="mt-6 max-w-[66ch] space-y-4 font-['Instrument_Serif',Georgia,serif] text-[19px] leading-[1.75]">
          {preview.split(/\n{2,}/).slice(0, 4).map(p => <p key={p.slice(0, 24)}>{p}</p>)}
        </div>
      </section>

      {book.series && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-heading text-[26px]">{t('reads.detail.series')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{book.series.name} · {book.series.index}</p>
          {seriesMates.length > 0 && (
            <ShelfRow title="" items={seriesMates.map(b => bookToShelfLite(b))} />
          )}
          {book.series.nextTitle && (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t('reads.detail.coming')}</p>
              <p className="mt-1 font-semibold">{book.series.nextTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{book.series.nextBlurb}</p>
            </div>
          )}
        </section>
      )}

      <ShelfRow title={t('reads.detail.related')} items={courses} />
    </article>
  );
}

function LangButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${active ? 'bg-[#203337] text-white' : 'border border-border'}`}>
      {children}
    </button>
  );
}

function bookToShelfLite(book: ReturnType<typeof publishedBooks>[number]) {
  return {
    id: book.id,
    kind: 'book' as const,
    href: `/reads/book/${book.id}`,
    title: book.title,
    subtitle: 'ET AI',
    description: book.blurb,
    cover: book.cover,
    badge: { label: book.genre, tone: 'preview' as const },
    tags: [],
    weekly: book.weeklyReads,
    releasedAt: book.releasedAt,
  };
}
