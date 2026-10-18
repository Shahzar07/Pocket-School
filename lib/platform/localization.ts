import type { Book } from '@/lib/reads/types';
import { isSupportedLanguage, readLanguage } from '@/lib/languages';
import { displayedField, type TranslationFields } from '@/lib/i18n/content-translation';

/**
 * One translated edition of a book.
 * The active language is the shared reader preference (`lib/languages.ts`,
 * applied by `I18nProvider`). A saved `languageVersions` row wins.
 * When that row is missing, `machine` asks the shared content translator
 * to fill the English source. Machine text is never marked approved.
 */
export interface LocalizedEdition {
  locale: string;
  sourceVersion: number;
  status: 'source' | 'draft' | 'review' | 'approved';
  aiTranslated: boolean;
  stale: boolean;
  /** No saved edition for this locale. The UI may request a machine translation. */
  machine: boolean;
  title: string;
  blurb: string;
  chapters: { id: string; title: string; markdown: string }[];
}

/** Saved app language. English when none is stored or the code is not in the shared list. */
export function activeLocale(): string {
  return readLanguage();
}

function sourceEdition(book: Book): LocalizedEdition {
  return {
    locale: 'en',
    sourceVersion: book.version,
    status: 'source',
    aiTranslated: false,
    stale: false,
    machine: false,
    title: book.title,
    blurb: book.blurb,
    chapters: book.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, markdown: chapter.markdown })),
  };
}

export function editionFor(book: Book, locale: string): LocalizedEdition {
  const source = sourceEdition(book);
  if (!locale || locale === 'en' || !isSupportedLanguage(locale)) return source;
  const version = book.languageVersions?.find(item => item.language === locale);
  if (!version) {
    return { ...source, locale, machine: true };
  }
  return {
    locale,
    sourceVersion: version.sourceVersion,
    status: version.status,
    aiTranslated: version.aiTranslated,
    stale: version.sourceVersion !== book.version,
    machine: false,
    title: version.title,
    blurb: version.blurb,
    chapters: book.chapters.map(chapter => {
      const translated = version.chapters.find(item => item.id === chapter.id);
      return translated ?? { id: chapter.id, title: chapter.title, markdown: chapter.markdown };
    }),
  };
}

/** Fields the shared translator accepts for the open chapter. */
export function editionSourceFields(edition: LocalizedEdition, chapterId?: string): TranslationFields {
  const chapter = edition.chapters.find(item => item.id === chapterId) ?? edition.chapters[0];
  return {
    title: edition.title,
    blurb: edition.blurb,
    chapterTitle: chapter?.title ?? '',
    markdown: chapter?.markdown ?? '',
  };
}

/**
 * Overlay a machine translation onto the English source.
 * `values` are already passed through `displayedFields`, so "show original"
 * arrives as the source text and is not labelled as a translation.
 */
export function applyTranslatedFields(
  edition: LocalizedEdition,
  values: TranslationFields,
  autoTranslated: boolean,
  chapterId?: string,
): LocalizedEdition {
  if (!edition.machine || !autoTranslated) return edition;
  const focus = chapterId ?? edition.chapters[0]?.id;
  return {
    ...edition,
    aiTranslated: true,
    title: displayedField(edition.title, values.title, false),
    blurb: displayedField(edition.blurb, values.blurb, false),
    chapters: edition.chapters.map(chapter => {
      if (chapter.id !== focus) return chapter;
      return {
        ...chapter,
        title: displayedField(chapter.title, values.chapterTitle, false),
        markdown: displayedField(chapter.markdown, values.markdown, false),
      };
    }),
  };
}
