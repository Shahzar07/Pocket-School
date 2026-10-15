/**
 * Product-agnostic manuscript blocks.
 *
 * A course lesson and a book chapter are both a titled markdown body.
 * Book Studio maps these onto chapters. The course CMS can map them onto
 * lessons (`Lesson.contentSources` text, or the body the lesson editor stores)
 * without a second paste/import implementation.
 */
export type ContentOrigin = 'ai' | 'human' | 'import';

export interface ContentBlock {
  id: string;
  title: string;
  /** Markdown. Images are `![alt](src "caption")` or `!full[alt](src "caption")`. */
  body: string;
  origin?: ContentOrigin;
}

export interface ImportWarning {
  blockId?: string;
  message: string;
}

export interface ImportResult {
  blocks: ContentBlock[];
  warnings: ImportWarning[];
  sourceName?: string;
}

export interface ContentRevision<T> {
  id: string;
  at: number;
  label: string;
  value: T;
}
