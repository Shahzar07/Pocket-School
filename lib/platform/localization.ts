import type { Book } from '@/lib/reads/types';

/**
 * One translated edition. Field names match a review record:
 * locale, source version, status, AI flag, and the translated fields.
 * When the geo language pack lands, map its record onto this and stop
 * reading `book.languageVersions` directly.
 */
export interface LocalizedEdition {
  locale: string;
  sourceVersion: number;
  status: 'source' | 'draft' | 'review' | 'approved';
  aiTranslated: boolean;
  stale: boolean;
  title: string;
  blurb: string;
  chapters: { id: string; title: string; markdown: string }[];
}

export function activeLocale(): string {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem('pocket-school-lang');
  if (saved) return saved;
  const nav = window.navigator.language?.slice(0, 2);
  return nav || 'en';
}

export function editionFor(book: Book, locale: string): LocalizedEdition {
  const source: LocalizedEdition = {
    locale: 'en',
    sourceVersion: book.version,
    status: 'source',
    aiTranslated: false,
    stale: false,
    title: book.title,
    blurb: book.blurb,
    chapters: book.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, markdown: chapter.markdown })),
  };
  if (!locale || locale === 'en') return source;
  const version = book.languageVersions?.find(item => item.language === locale);
  if (!version) return source;
  return {
    locale,
    sourceVersion: version.sourceVersion,
    status: version.status,
    aiTranslated: version.aiTranslated,
    stale: version.sourceVersion !== book.version,
    title: version.title,
    blurb: version.blurb,
    chapters: book.chapters.map(chapter => {
      const translated = version.chapters.find(item => item.id === chapter.id);
      return translated ?? { id: chapter.id, title: chapter.title, markdown: chapter.markdown };
    }),
  };
}
