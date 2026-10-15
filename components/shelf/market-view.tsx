'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookCover } from '@/components/shelf/book-cover';
import { ProfileSwitch, useShelfProfile } from '@/components/shelf/profile-bar';
import { Chip, Hero, ResultGrid, SearchField, ShelfRow } from '@/components/shelf/ui';
import { getPublicCourses } from '@/lib/db';
import { SAMPLE_OWNED, SAMPLE_READER } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';
import {
  bookToShelf,
  courseToShelf,
  mergeCourses,
  relatedBooksForCourse,
  seedCourseViews,
  topTen,
  visibleBooks,
  type CourseView,
} from '@/lib/shelf/catalogue';
import { ageNumber } from '@/lib/reads/types';
import { myList, progressMap, toggleList } from '@/lib/shelf/storage';
import type { ShelfItem } from '@/lib/shelf/types';

function sameShelf(source: ShelfItem, item: ShelfItem): boolean {
  if (item.id === source.id) return false;
  const stop = new Set(['course', 'complete', 'foundations', 'mastery', 'introduction', 'papers']);
  const words = `${source.subject ?? ''} ${source.title} ${source.tags.join(' ')}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 4 && !stop.has(word));
  const hay = `${item.subject ?? ''} ${item.title} ${item.level ?? ''} ${item.tags.join(' ')}`.toLowerCase();
  return words.some(word => hay.includes(word));
}

export function MarketHome() {
  const t = useReadsT();
  const { profile, ready, choose } = useShelfProfile();
  const [courses, setCourses] = useState<CourseView[]>(() => seedCourseViews());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState<string[]>([]);
  const [progress, setProgress] = useState<Record<string, { percent: number }>>({});

  useEffect(() => {
    let cancelled = false;
    getPublicCourses()
      .then(rows => { if (!cancelled) setCourses(mergeCourses(rows)); })
      .catch(() => { if (!cancelled) setCourses(mergeCourses([])); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setList(myList(profile.id));
    setProgress(progressMap(profile.id));
  }, [ready, profile.id]);

  const courseItems = useMemo(
    () => courses.map(course => courseToShelf(course, progress[course.id]?.percent)),
    [courses, progress],
  );
  const bookItems = useMemo(
    () => visibleBooks(profile.maxAge).map(book => bookToShelf(book, SAMPLE_READER, SAMPLE_OWNED, progress[book.id]?.percent)),
    [profile.maxAge, progress],
  );

  const continueItems = courseItems
    .filter(item => (item.progress ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
  const hero = continueItems[0] ?? [...courseItems].sort((a, b) => b.weekly - a.weekly)[0];
  const heroCourse = hero ? courses.find(course => course.id === hero.id) : undefined;
  const becauseSource = continueItems[0];
  const becauseBooks = becauseSource
    ? relatedBooksForCourse(becauseSource.subject ?? '', becauseSource.tags)
      .filter(book => profile.maxAge == null || ageNumber(book.ageRating) <= profile.maxAge)
      .map(book => bookToShelf(book, SAMPLE_READER, SAMPLE_OWNED, progress[book.id]?.percent))
    : [];
  const because = becauseSource
    ? [...courseItems.filter(item => sameShelf(becauseSource, item)), ...becauseBooks]
    : [];
  const biology = courseItems.filter(item => `${item.subject ?? ''} ${item.tags.join(' ')}`.toLowerCase().includes('biology'));
  const levels = [...new Set(courseItems.map(item => item.level).filter((level): level is string => Boolean(level)))];
  const listed = [...courseItems, ...bookItems].filter(item => list.includes(item.id));
  const alongside = bookItems
    .filter(book => !becauseBooks.some(item => item.id === book.id))
    .slice(0, 8);

  const pool: ShelfItem[] = filter === 'books' ? bookItems : filter === 'courses' ? courseItems : [...courseItems, ...bookItems];
  const filtered = pool.filter(item => {
    if (filter === 'free' && item.badge.tone !== 'free') return false;
    if (filter === 'included' && item.badge.tone !== 'included' && item.badge.tone !== 'owned') return false;
    if (filter === 'buy' && item.badge.tone !== 'buy' && item.badge.tone !== 'locked') return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!`${item.title} ${item.description} ${item.subtitle} ${item.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (!hero) return null;
  const searching = query.trim().length > 0 || filter !== 'all';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{t('reads.market.sample')}</p>
        <div className="flex items-center gap-3">
          <Link href="/reads" className="text-[13px] font-semibold text-primary">{t('reads.market.reads')}</Link>
          <ProfileSwitch profile={profile} onChoose={choose} label={t('reads.profile.switch')} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query} onChange={setQuery} placeholder={t('reads.market.search')} />
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {([
            ['all', t('reads.filter.all')],
            ['courses', t('reads.filter.courses')],
            ['books', t('reads.filter.books')],
            ['free', t('reads.filter.free')],
            ['included', t('reads.filter.included')],
            ['buy', t('reads.filter.buy')],
          ] as const).map(([id, label]) => (
            <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{label}</Chip>
          ))}
        </div>
      </div>

      {searching ? (
        <section className="space-y-4">
          <h2 className="font-heading text-[26px]">{t('reads.market.results')}</h2>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t('reads.market.empty')}</p> : <ResultGrid items={filtered} />}
        </section>
      ) : (
        <>
          <Hero
            eyebrow={[hero.subject, hero.level].filter(Boolean).join(' · ') || hero.subtitle}
            title={hero.title}
            description={heroCourse?.description || hero.description}
            badges={[hero.badge]}
            primary={{ href: hero.href, label: t('reads.market.start') }}
            listed={list.includes(hero.id)}
            onToggleList={() => setList(toggleList(profile.id, hero.id))}
            listLabel={t('reads.myList')}
            listedLabel={t('reads.listed')}
            visual={
              hero.kind === 'book' && hero.cover
                ? <BookCover title={hero.title} cover={hero.cover} className="h-full min-h-[260px]" />
                : hero.image
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hero.image} alt="" className="h-full min-h-[260px] w-full object-cover" />
                  )
                  : null
            }
          />
          <ShelfRow title={t('reads.market.continue')} items={continueItems} />
          <ShelfRow title={t('reads.market.top')} items={topTen(courseItems)} ranked />
          <ShelfRow title={t('reads.market.trending')} items={[...courseItems].sort((a, b) => b.weekly - a.weekly).slice(0, 8)} />
          {becauseSource && <ShelfRow title={t('reads.market.because', { title: becauseSource.title })} items={because} />}
          <ShelfRow title={t('reads.market.curriculum')} items={biology} />
          {levels.map(level => (
            <ShelfRow key={level} title={t('reads.market.forLevel', { level })} items={courseItems.filter(item => item.level === level)} />
          ))}
          <ShelfRow title={t('reads.market.new')} items={[...courseItems].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))} />
          <ShelfRow title={t('reads.market.books')} items={alongside} action={{ href: '/reads', label: t('reads.nav.home') }} />
          <ShelfRow title={t('reads.market.list')} items={listed} />
        </>
      )}
    </div>
  );
}
