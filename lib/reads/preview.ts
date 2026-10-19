import { chapterPlain } from '@/lib/reads/book-export';
import { screenCoverAge } from '@/lib/reads/cover';
import { paginateChapter } from '@/lib/reads/paginate';
import { quotePrice } from '@/lib/platform/pricing';
import type { ReadingLevel } from '@/lib/reads/types';
import { PREVIEW } from '@/lib/reads/preview-copy';

const LEVELS: Record<ReadingLevel, string> = {
  primary: 'Primary',
  'lower-secondary': 'Lower secondary',
  igcse: 'IGCSE',
  'a-level': 'A-Level',
  general: 'General',
  professional: 'Professional',
  law: 'Law',
};

export function readingLevelLabel(level: string | undefined): string {
  if (level && level in LEVELS) return LEVELS[level as ReadingLevel];
  return 'General';
}

export function readingMinutes(chapters: { markdown: string }[]): number {
  const words = chapters
    .map(chapter => chapterPlain(chapter.markdown))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 180));
}

/** USD from the PoketReads price, or the subscription line when the book is not sold on its own. */
export function readsOfferLabel(book: { priceUsd: number; accessMode: string }): string {
  if (book.accessMode === 'subscription' || !(book.priceUsd > 0)) return PREVIEW.included;
  return quotePrice(book.priceUsd, 'USD', 'USD').usdLabel;
}

export function hasCoverImage(book: { cover?: { image?: string }; coverBrief?: { artSrc?: string } }): boolean {
  return Boolean(book.cover?.image?.trim() || book.coverBrief?.artSrc?.trim());
}

export function hasCoverAlt(book: { coverBrief?: { alt?: string } }): boolean {
  return Boolean(book.coverBrief?.alt?.trim());
}

export function hasChapter(book: { chapters: { markdown: string }[] }): boolean {
  return book.chapters.some(chapter => chapterPlain(chapter.markdown).length > 0 || /!(?:full)?\[[^\]]*\]\(/.test(chapter.markdown));
}

/** Publish stays closed until the cover, its alt text, and a chapter are in place. */
export function previewPublishIssues(book: {
  title: string;
  blurb: string;
  ageRating: string;
  cover?: { image?: string };
  coverBrief?: { artSrc?: string; alt?: string; prompt?: string };
  images?: { alt: string }[];
  chapters: { markdown: string }[];
}): string[] {
  const issues: string[] = [];
  if (!hasCoverImage(book)) issues.push(PREVIEW.needCover);
  if (!hasCoverAlt(book)) issues.push(PREVIEW.needAlt);
  if (!hasChapter(book)) issues.push(PREVIEW.needChapter);
  if ((book.images ?? []).some(image => !image.alt.trim())) {
    issues.push('Every picture needs alt text before publishing.');
  }
  if (book.chapters.some(chapter => /!(?:full)?\[\s*\]\(/.test(chapter.markdown))) {
    issues.push('A picture in the chapter text is missing alt text.');
  }
  if (hasCoverImage(book)) {
    const screen = screenCoverAge(book.ageRating, `${book.title}\n${book.blurb}\n${book.coverBrief?.prompt ?? ''}\n${book.coverBrief?.alt ?? ''}`);
    if (!screen.ok) issues.push(screen.note);
  }
  return issues;
}

export interface ReaderPage {
  chapterTitle: string;
  markdown: string;
}

/** One spread per page. Picture markdown stays intact so the preview can draw it. */
export function readerPages(chapters: { order: number; title: string; markdown: string }[], wordsPerPage = 120): ReaderPage[] {
  const pages: ReaderPage[] = [];
  const ordered = [...chapters].sort((a, b) => a.order - b.order);
  for (const chapter of ordered) {
    for (const markdown of paginateChapter(chapter.markdown || '', wordsPerPage)) {
      pages.push({ chapterTitle: chapter.title, markdown });
    }
  }
  return pages;
}

export function pageLabel(index: number, total: number): string {
  const count = Math.max(total, 1);
  const current = Math.min(count, Math.max(1, index + 1));
  return `Page ${current} of ${count}`;
}
