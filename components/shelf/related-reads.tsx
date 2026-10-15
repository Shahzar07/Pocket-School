'use client';

import { ShelfRow } from '@/components/shelf/ui';
import { bookToShelf, relatedBooksForCourse } from '@/lib/shelf/catalogue';
import { SAMPLE_OWNED, SAMPLE_READER } from '@/lib/reads/access';
import { useReadsT } from '@/lib/reads/i18n';

/** Books that sit next to a course. Shared by the live course page and the catalogue preview. */
export function RelatedReads({ subject, tags }: { subject: string; tags: string[] }) {
  const t = useReadsT();
  const items = relatedBooksForCourse(subject, tags).map(book => bookToShelf(book, SAMPLE_READER, SAMPLE_OWNED));
  return <ShelfRow title={t('reads.market.related')} items={items} action={{ href: '/reads', label: t('reads.market.reads') }} />;
}
