'use client';

import { useEffect, useState } from 'react';
import { useShelfProfile } from '@/components/shelf/profile-bar';
import { ShelfRow } from '@/components/shelf/ui';
import { bookToShelf, courseToShelf, seedCourseViews, visibleBooks } from '@/lib/shelf/catalogue';
import { SAMPLE_OWNED, SAMPLE_READER, ownsBook, subscriptionIncludes } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';
import { childHidden, minutesToday, myList, progressMap, setChildHidden } from '@/lib/shelf/storage';

export function LibraryView() {
  const t = useReadsT();
  const { profile, ready } = useShelfProfile();
  const [progress, setProgress] = useState<Record<string, { percent: number }>>({});
  const [list, setList] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setProgress(progressMap(profile.id));
    setList(myList(profile.id));
    setHidden(childHidden());
  }, [ready, profile.id]);

  const books = visibleBooks(profile.maxAge);
  const items = books.map(b => bookToShelf(b, SAMPLE_READER, SAMPLE_OWNED, progress[b.id]?.percent));
  const owned = items.filter(i => ownsBook(i.id, SAMPLE_READER, SAMPLE_OWNED));
  const plan = items.filter(i => {
    const book = books.find(b => b.id === i.id);
    return book ? subscriptionIncludes(book, SAMPLE_READER) && !ownsBook(book.id, SAMPLE_READER, SAMPLE_OWNED) : false;
  });
  const saved = [
    ...items.filter(i => list.includes(i.id)),
    ...seedCourseViews().filter(c => list.includes(c.id)).map(c => courseToShelf(c)),
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{profile.name}</p>
        <h1 className="mt-2 font-heading text-[40px] tracking-[-0.04em] sm:text-[52px]">{t('reads.library.title')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('reads.library.lead')}</p>
      </header>
      {profile.kind === 'parent' && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-heading text-[26px]">{t('reads.library.family')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('reads.library.familyLead')}</p>
          <p className="mt-3 text-sm">Aisha · {t('reads.board.minutes', { count: minutesToday('aisha') })} · Imran · {t('reads.board.minutes', { count: minutesToday('imran') })}</p>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={hidden}
              onChange={e => { setChildHidden(e.target.checked); setHidden(e.target.checked); }}
            />
            {t('reads.library.hide')}
          </label>
        </section>
      )}
      <ShelfRow title={t('reads.library.owned')} items={owned} />
      <ShelfRow title={t('reads.library.plan')} items={plan} />
      <ShelfRow title={t('reads.library.list')} items={saved} />
      {owned.length + plan.length + saved.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('reads.library.empty')}</p>
      )}
    </div>
  );
}
