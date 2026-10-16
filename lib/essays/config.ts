/**
 * Thresholds for ET Essays. A school can read these; the desk does not invent its own.
 * A flag withholds the essay grade. It does not change any other mark.
 */

export const ESSAY_INTEGRITY = {
  /** One paste that also inserts at least this many characters is a paste burst. */
  pasteEvents: 1,
  largeInsertChars: 250,
  /** 0–100 writing signal from the shared integrity module, or from the model check. */
  aiLikelihood: 70,
  /** Concern score from buildIntegrityCase. */
  caseScore: 70,
} as const;

export const PLAN_SHAPE = {
  /** Long sentences in one reply. Three or more means the reply is an essay. */
  maxLongSentences: 2,
  longSentenceWords: 12,
  /** A block this long, split by a blank line, is a paragraph of the essay. */
  paragraphWords: 40,
  exemplarWords: 70,
} as const;

export const ESSAY_FLAG_STATUS = 'Flagged – redo required';

export const ESSAY_FLAG_MESSAGE =
  'This submission appears AI-generated. ET Essays has not given a grade. Rewrite it and submit again.';
