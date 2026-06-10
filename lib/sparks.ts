// ─── Sparks credit economy ──────────────────────────────────────
// Costs to unlock each AI content format on a curriculum lesson, and
// rewards for progress. Gating applies ONLY to courses with
// kind === 'curriculum'; marketplace lessons remain fully free.

import type { AiOutputs } from './db';

/** Spark cost to unlock each content format on a curriculum lesson. */
export const FORMAT_COSTS: Record<string, number> = {
  text: 15,
  videoScript: 15,
  flashcards: 5,
  mindmap: 10,
  infographic: 15,
  quiz: 5,
  problems: 5,
  audioScript: 10,
  glossary: 5,
  notes: 5,
  slides: 10,
};

/** Sparks earned for completing a curriculum lesson. */
export const LESSON_COMPLETE_REWARD = 10;

/** Sparks earned for passing a unit mastery quiz (≥ threshold). */
export const UNIT_PASS_REWARD = 50;

/** Monthly Sparks allowance for the Academic subscription tier. */
export const ACADEMIC_MONTHLY_ALLOWANCE = 400;

/** One-off welcome grant on student onboarding. */
export const SIGNUP_GRANT = 100;

/** Human-readable labels for format keys (shared by player tabs + CMS). */
export const FORMAT_LABELS: Record<string, string> = {
  text: 'Lesson',
  videoScript: 'Video',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  infographic: 'Infographic',
  quiz: 'Quiz',
  problems: 'Practice',
  audioScript: 'Audio Summary',
  glossary: 'Glossary',
  notes: 'Revision Notes',
  slides: 'Slides',
};

export function getFormatCost(format: string): number {
  return FORMAT_COSTS[format] ?? 5;
}

/** Format keys present on a lesson's aiOutputs, in display order. */
export function availableFormats(outputs?: AiOutputs): string[] {
  if (!outputs) return [];
  return Object.keys(FORMAT_COSTS).filter((key) => {
    const value = outputs[key as keyof AiOutputs];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}
