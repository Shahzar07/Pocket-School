import type { Book } from '@/lib/reads/types';
import { readLanguage } from '@/lib/languages';

/**
 * One translated edition of a book.
 * The active language is the shared reader preference (`lib/languages.ts`,
 * applied by `I18nProvider`). This file only picks the matching book edition.
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

/** Saved app language. English when none is stored or the code is not in the shared list. */
export function activeLocale(): string {
  return readLanguage();
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
