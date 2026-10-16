import type { ContentOrigin } from '@/components/editor/types';
import type { MediaAsset } from '@/components/media/types';
import type { AccessTier } from '@/lib/entitlements';
import type { CoverBrief } from '@/lib/reads/cover';
import type { CoverStyle } from '@/lib/shelf/types';

/** Audiences the shared allocator multi-selects. A book stores the chosen array. */
export const BOOK_TARGETS = ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'] as const;
export type BookTarget = (typeof BOOK_TARGETS)[number];

export type BookCategory = 'academic' | 'general' | 'childrens_stories';
export type BookForm = 'fiction' | 'non-fiction';
export type BookStatus = 'draft' | 'review' | 'published';
export type AccessMode = 'subscription' | 'purchase' | 'both';
export type AgeRating = '5+' | '8+' | '12+' | '14+' | '16+' | '18+';
export type ReadingLevel =
  | 'primary'
  | 'lower-secondary'
  | 'igcse'
  | 'a-level'
  | 'general'
  | 'professional'
  | 'law';

export interface CurriculumTag {
  programme?: string;
  subject?: string;
  year?: string;
}

export interface ChapterQuiz {
  question: string;
  options: string[];
  answer: string;
}

export interface BookChapter {
  id: string;
  order: number;
  title: string;
  markdown: string;
  /** First chapter of a published book is the free sample. */
  preview?: boolean;
  quiz?: ChapterQuiz[];
  /** Spoiler-safe notes ET can answer from without calling the model. */
  guide?: { q: string; a: string }[];
  /** Where the prose came from. Absent on the seeded source chapters. */
  origin?: ContentOrigin;
}

/**
 * A translation of a book, cached against the source version it was made from.
 *
 * This is deliberately small. The in-flight localisation PR owns CMS lesson
 * translation and review; when it lands, language versions should adopt that
 * review record instead of growing a second workflow. Until then a version is
 * just the translated fields, the source version, an AI flag, and a status.
 */
export interface LanguageVersion {
  language: string;
  sourceVersion: number;
  status: 'draft' | 'review' | 'approved';
  aiTranslated: boolean;
  title: string;
  blurb: string;
  chapters: { id: string; title: string; markdown: string }[];
}

export interface BookSeries {
  id: string;
  name: string;
  index: number;
  /** Announced sequel that is not a readable book yet. */
  nextTitle?: string;
  nextBlurb?: string;
}

export interface Book {
  id: string;
  title: string;
  author: 'ET AI';
  blurb: string;
  cover: CoverStyle;
  category: BookCategory;
  form: BookForm;
  genre: string;
  ageRating: AgeRating;
  readingLevel: ReadingLevel;
  /** Children's picture books. The reader opens one illustration per page. */
  pictureBook?: boolean;
  /** Age band id such as `5-7`. Used instead of a school year. */
  ageBand?: string;
  curriculumTags: CurriculumTag[];
  status: BookStatus;
  version: number;
  accessMode: AccessMode;
  minTier: AccessTier;
  /** Canonical price. Local currency is a display conversion. */
  priceUsd: number;
  /** MYR list price at the dated FX table. Display does not read this. */
  priceRM: number;
  /** An institution academy can licence this title. */
  licensable: boolean;
  /** Sparks to unlock, once the Sparks ledger can grant `sparks:book:{id}`. */
  sparksCost?: number;
  /** Licence cap. `used` is not a live counter. */
  seats?: { total: number; used: number };
  /** Matches a value in lib/programmes.ts. */
  programme?: string;
  /** ISO date the allocator should hide the title until. */
  availableFrom?: string;
  /** On the subscription shelf once published. */
  allocateLibrary: boolean;
  /** Listed in the store once published. */
  allocateMarketplace: boolean;
  /** Who this book is for. Absent means the default set from the library and marketplace flags. */
  targets?: string[];
  series?: BookSeries;
  chapters: BookChapter[];
  /** Pictures for this book. Alt text is required before one can be placed or published. */
  images?: MediaAsset[];
  /** Cover picture and the book-only overlay. The picture comes from components/media. */
  coverBrief?: CoverBrief;
  /** Weekly reads, used for Trending and Top 10. Editorial, not a live counter. */
  weeklyReads: number;
  releasedAt: string;
  region?: string;
  languageVersions?: LanguageVersion[];
  /** Idea-to-book notes. Absent on older titles. Prices are not stored here. */
  craft?: BookCraft;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  traits: string;
  appearance: string;
  backstory: string;
  voice: string;
  relationships: string;
  portrait?: string;
}

export interface SceneCard {
  id: string;
  title: string;
  summary: string;
  act: string;
  twist: boolean;
}

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

export interface SavedPrompt {
  id: string;
  name: string;
  body: string;
}

/** Studio-only writing desk. It does not carry a price. */
export interface BookCraft {
  kind: string;
  idea: string;
  logline: string;
  tone: string;
  audience: string;
  titles: string[];
  language: string;
  styleId: string;
  structure: string;
  characters: StoryCharacter[];
  worldName: string;
  worldTime: string;
  worldPlace: string;
  worldRules: string;
  scenes: SceneCard[];
  objectives: string[];
  glossary: GlossaryEntry[];
  references: string[];
  customPrompts: SavedPrompt[];
}

export function ageNumber(rating: AgeRating): number {
  const n = parseInt(rating, 10);
  return Number.isFinite(n) ? n : 18;
}
