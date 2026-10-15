'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RelatedReads } from '@/components/shelf/related-reads';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { ShelfBadgePill } from '@/components/shelf/ui';
import { useReadsT } from '@/lib/reads/i18n';
import { courseToShelf, seedCourseViews } from '@/lib/shelf/catalogue';
import { viewerCurrency } from '@/lib/platform/pricing';
import { myList, toggleList } from '@/lib/shelf/storage';

export function CourseCatalogueDetail({ seedKey }: { seedKey: string }) {
  const t = useReadsT();
  const course = seedCourseViews().find(item => item.id === `seed:${seedKey}` || item.href.endsWith(`/${seedKey}`));
  const { profile, ready } = useShelfProfile();
  const [list, setList] = useState<string[]>([]);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!ready) return;
    setList(myList(profile.id));
    setCurrency(viewerCurrency());
  }, [ready, profile.id]);

  if (!course) {
    return <p className="text-sm text-muted-foreground">{t('reads.market.missing')}</p>;
  }

  const item = courseToShelf(course, undefined, currency);
  const preview = course.description.split(/(?<=\.)\s+/).slice(0, 2).join(' ');

  return (
    <article className="mx-auto max-w-[1240px] space-y-8 px-4 py-8 sm:px-6">
      <Link href="/courses" className="text-[13px] font-semibold text-primary">{t('reads.nav.courses')}</Link>
      <div className="grid items-start gap-8 lg:grid-cols-[360px_1fr]">
        <div className="overflow-hidden rounded-xl shadow-[var(--shadow-card-hover)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.image} alt="" className="aspect-[16/10] w-full object-cover" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            {course.subject} · {course.level}
          </p>
          <h1 className="mt-2 font-heading text-[42px] leading-[0.98] tracking-[-0.04em] sm:text-[56px]">{course.title}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{course.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ShelfBadgePill badge={item.badge} />
            {item.extra && <span className="text-[12px] text-muted-foreground">{item.extra}</span>}
            <span className="text-[12px] text-muted-foreground">{course.durationHours}h · {course.ownerName}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#preview" className="inline-flex h-11 items-center rounded-full bg-[#203337] px-5 text-sm font-bold text-white">
              {t('reads.market.preview')}
            </a>
            <button
              type="button"
              onClick={() => setList(toggleList(profile.id, course.id))}
              className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold"
            >
              {list.includes(course.id) ? t('reads.listed') : t('reads.myList')}
            </button>
          </div>
          <p className="mt-4 max-w-lg text-sm text-muted-foreground">{t('reads.market.checkout')}</p>
        </div>
      </div>

      <section id="preview" className="rounded-[28px] border border-border bg-[#F7F1E6] p-6 text-[#2C241C] sm:p-10">
        <h2 className="font-heading text-[28px]">{t('reads.market.preview')}</h2>
        <p className="mt-4 max-w-[66ch] font-['Instrument_Serif',Georgia,serif] text-[19px] leading-[1.75]">{preview}</p>
      </section>

      <section>
        <h2 className="font-heading text-[28px]">{t('reads.market.learn')}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {course.whatYouLearn.map(point => (
            <li key={point} className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed">{point}</li>
          ))}
        </ul>
      </section>

      {course.requirements.length > 0 && (
        <section>
          <h2 className="font-heading text-[28px]">{t('reads.market.requirements')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {course.requirements.map(point => <li key={point}>{point}</li>)}
          </ul>
        </section>
      )}

      <RelatedReads subject={course.subject} tags={course.tags} />
    </article>
  );
}
