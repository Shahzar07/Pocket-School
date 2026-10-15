'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookCover } from '@/components/shelf/book-cover';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { Chip, Hero, ResultGrid, SearchField, ShelfRow } from '@/components/shelf/ui';
import { bookToShelf, topTen, visibleBooks } from '@/lib/shelf/catalogue';
import { seedCourseViews, courseToShelf, relatedCoursesForBook } from '@/lib/shelf/catalogue';
import { SAMPLE_OWNED, SAMPLE_READER, ownsBook, subscriptionIncludes } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';
import { bookById } from '@/lib/reads/seed';
import { viewerCurrency } from '@/lib/platform/pricing';
import { recommend } from '@/lib/shelf/recommend';
import { minutesToday, myList, progressMap, streakDays, toggleList } from '@/lib/shelf/storage';
import { readAwards } from '@/lib/platform/gamification';
import { localDateKey, readingGoal } from '@/lib/platform/reading';
import { booksFinishedFromProgress, parentReadingReport } from '@/lib/platform/reports';
import type { ShelfItem } from '@/lib/shelf/types';

export function ReadsHome() {
  const t = useReadsT();
  const { profile, ready } = useShelfProfile();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState<string[]>([]);
  const [progress, setProgress] = useState<Record<string, { percent: number }>>({});
  const [streak, setStreak] = useState(0);
  const [today, setToday] = useState(0);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!ready) return;
    setList(myList(profile.id));
    setProgress(progressMap(profile.id));
    setStreak(streakDays(profile.id));
    setToday(minutesToday(profile.id));
    setCurrency(viewerCurrency());
  }, [ready, profile.id]);

  const books = useMemo(() => visibleBooks(profile.maxAge).map(book => {
    const item = bookToShelf(book, SAMPLE_READER, SAMPLE_OWNED, progress[book.id]?.percent, currency);
    return item;
  }), [profile.maxAge, progress, currency]);

  const courses = useMemo(() => seedCourseViews().map(c => courseToShelf(c, progress[c.id]?.percent, currency)), [progress, currency]);

  const continueItems = books.filter(b => (b.progress ?? 0) > 0).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  const becauseOf = continueItems[0];
  const becauseBook = becauseOf ? bookById(becauseOf.id) : undefined;
  const because = becauseOf ? recommend(books, becauseOf, 8) : [];
  const biology = books.filter(b => b.subject?.toLowerCase().includes('biology') || b.tags.includes('biology'));
  const kids = books.filter(b => (b.age ?? 18) <= 8);
  const owned = books.filter(b => b.badge.tone === 'owned');
  const included = books.filter(b => b.badge.tone === 'included');
  const listed = books.filter(b => list.includes(b.id));
  const newest = [...books].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  const trending = [...books].filter(b => b.tags.length).sort((a, b) => b.weekly - a.weekly);
  const study = becauseBook ? relatedCoursesForBook(becauseBook, seedCourseViews()).map(c => courseToShelf(c, undefined, currency)) : courses.slice(0, 4);

  const filtered = books.filter(item => {
    if (filter === 'academic' && item.category !== 'academic') return false;
    if (filter === 'general' && item.category !== 'general') return false;
    if (filter === 'fiction' && item.form !== 'fiction') return false;
    if (filter === 'nonfiction' && item.form !== 'non-fiction') return false;
    if (filter === 'included' && item.badge.tone !== 'included' && item.badge.tone !== 'owned') return false;
    if (filter === 'buy' && item.badge.tone !== 'buy' && item.badge.tone !== 'locked') return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!`${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const heroBook = bookById(continueItems[0]?.id ?? books[0]?.id ?? '');
  const heroItem = books.find(b => b.id === heroBook?.id) ?? books[0];

  if (!heroItem || !heroBook) return null;

  const searching = query.trim().length > 0 || filter !== 'all';
  const goalDoc = readingGoal({
    studentId: profile.id,
    dateKey: localDateKey(),
    estimateMinutes: 15,
    activeSeconds: today * 60,
  });
  const goal = goalDoc?.estimateMinutes ?? 15;
  const awards = readAwards(profile.id);

  return (
    <div className="space-y-8">
      {profile.kind !== 'parent' && (
        <p className="rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-[13px] leading-relaxed text-secondary-foreground">
          {t('reads.previewBanner')}
        </p>
      )}

      {profile.kind === 'parent' ? <FamilyReport /> : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t('reads.home.streak', { count: streak })}</p>
            <p className="mt-1 text-sm text-foreground">{t('reads.home.goalCategory')}</p>
            {awards.xp > 0 && <p className="text-[12px] text-muted-foreground">{t('reads.home.xp', { count: awards.xp })}</p>}
          </div>
          <div className="min-w-[200px] flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>{t('reads.home.goal')}</span>
              <span className="font-semibold text-foreground">{t('reads.home.goalProgress', { done: Math.min(today, goal), goal })}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query} onChange={setQuery} placeholder={t('reads.search')} />
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {([
            ['all', t('reads.filter.all')],
            ['fiction', t('reads.filter.fiction')],
            ['nonfiction', t('reads.filter.nonfiction')],
            ['academic', t('reads.filter.academic')],
            ['general', t('reads.filter.general')],
            ['included', t('reads.filter.included')],
            ['buy', t('reads.filter.buy')],
          ] as const).map(([id, label]) => (
            <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{label}</Chip>
          ))}
        </div>
      </div>

      {searching ? (
        <section className="space-y-4">
          <h2 className="font-heading text-[26px]">{t('reads.home.results')}</h2>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t('reads.home.emptySearch')}</p> : <ResultGrid items={filtered} />}
        </section>
      ) : (
        <>
          <Hero
            eyebrow={heroItem.extra ?? heroBook.genre}
            title={heroItem.title}
            description={heroBook.blurb}
            badges={[heroItem.badge]}
            primary={{ href: `/reads/read/${heroBook.id}`, label: t('reads.detail.read') }}
            listed={list.includes(heroBook.id)}
            onToggleList={() => setList(toggleList(profile.id, heroBook.id))}
            listLabel={t('reads.myList')}
            listedLabel={t('reads.listed')}
            visual={heroBook.cover ? <BookCover title={heroBook.title} cover={heroBook.cover} className="h-full min-h-[260px]" /> : null}
          />
          <ShelfRow title={t('reads.home.continue')} items={continueItems} />
          <ShelfRow title={t('reads.home.top')} items={topTen(books)} ranked />
          <ShelfRow title={t('reads.home.trending')} items={trending.slice(0, 8)} />
          {becauseOf && <ShelfRow title={t('reads.home.because', { title: becauseOf.title })} items={because} />}
          <ShelfRow title={t('reads.home.curriculum')} items={biology} />
          <ShelfRow title={t('reads.home.new')} items={newest} />
          <ShelfRow title={t('reads.home.kids')} items={kids} />
          <ShelfRow title={t('reads.home.owned')} items={owned} />
          <ShelfRow title={t('reads.home.included')} items={included} />
          <ShelfRow title={t('reads.home.list')} items={listed} />
          <ShelfRow title={t('reads.home.courses')} items={study} action={{ href: '/courses', label: t('reads.nav.courses') }} />
        </>
      )}
      <p className="sr-only">{ownsBook('harbour-light', SAMPLE_READER, SAMPLE_OWNED) ? 'owned' : ''}{subscriptionIncludes(heroBook, SAMPLE_READER) ? 'included' : ''}</p>
      <Link href="/reads/library" className="sr-only">{t('reads.nav.library')}</Link>
    </div>
  );
}

function FamilyReport() {
  const t = useReadsT();
  const aisha = parentReadingReport({
    studentId: 'aisha',
    period: 'week',
    readingMinutes: minutesToday('aisha'),
    booksFinished: booksFinishedFromProgress(progressMap('aisha')),
  });
  const imran = parentReadingReport({
    studentId: 'imran',
    period: 'week',
    readingMinutes: minutesToday('imran'),
    booksFinished: booksFinishedFromProgress(progressMap('imran')),
  });
  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{t('reads.library.family')}</p>
      <h2 className="mt-2 font-heading text-[32px] tracking-[-0.04em]">{t('reads.library.familyLead')}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Report name="Aisha" minutes={aisha.readingMinutes} finished={aisha.booksFinished} tint="var(--primary)" />
        <Report name="Imran" minutes={imran.readingMinutes} finished={imran.booksFinished} tint="var(--chart-3)" />
      </div>
    </section>
  );
}

function Report({ name, minutes, finished, tint }: { name: string; minutes: number; finished: number; tint: string }) {
  const t = useReadsT();
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-primary-foreground" style={{ background: tint }}>{name.slice(0, 1)}</span>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{t('reads.board.minutes', { count: minutes })} · {t('reads.library.finished', { count: finished })}</p>
        </div>
      </div>
    </div>
  );
}

export type { ShelfItem };
