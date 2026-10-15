// ─── Sparks credit economy ──────────────────────────────────────
// Costs to unlock each AI content format on a curriculum lesson, and
// rewards for progress. Gating applies ONLY to courses with
// kind === 'curriculum'; marketplace lessons remain fully free.

import type { AiOutputs } from './db';
import { accessTierFor, tierDefinition } from './entitlements';

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

/**
 * @deprecated Use monthlySparksForProfile(). Kept so older imports compile.
 * The number is the IGCSE & A-Level plan (tier 2) from lib/entitlements.ts — the
 * single source of truth — not a separate 400-Spark figure.
 */
export const ACADEMIC_MONTHLY_ALLOWANCE = 800;

/** One-off welcome grant every student receives on onboarding. */
export const SIGNUP_GRANT = 50;

/** Working balance given to administrator accounts so they can exercise every
 * paid surface while testing, without spending a student's allowance. */
export const ADMIN_SPARKS_GRANT = 2000;

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

type SparksProfile = {
  accessTier?: number | null;
  subscriptionTier?: string | null;
  role?: string | null;
  sparksMonthlyAllowance?: number | null;
};

/**
 * Monthly Sparks for a person. The plan table in lib/entitlements.ts decides the
 * number. A stored sparksMonthlyAllowance is only used when it was set by the
 * server for a custom institution deal (it never overrides a free account up).
 */
export function monthlySparksForProfile(profile: SparksProfile | null | undefined): number {
  const fromPlan = tierDefinition(accessTierFor(profile)).sparks;
  const custom = profile?.sparksMonthlyAllowance;
  if (typeof custom === 'number' && custom > fromPlan) return custom;
  return fromPlan;
}

export function sparksRolloverForProfile(profile: SparksProfile | null | undefined): number {
  return tierDefinition(accessTierFor(profile)).sparksRollover;
}

/** Plain-language lines for the explainer. Kept next to the numbers they describe. */
export const SPARKS_EXPLAINER = {
  title: 'What are Sparks?',
  summary:
    'Sparks are learning credits. You spend them to open extra formats of a lesson — the video, the quiz, the audio, and the rest. The first lesson of every course is free.',
  earn: [
    `You receive ⚡${SIGNUP_GRANT} when you finish signing up.`,
    `You earn ⚡${LESSON_COMPLETE_REWARD} each time you finish a lesson.`,
    `You earn ⚡${UNIT_PASS_REWARD} when you pass a module quiz.`,
    'Your plan adds a monthly allowance. The pricing page and your balance use the same numbers.',
  ],
  spend: 'Before anything is spent, you see the cost and your balance, and you confirm.',
};

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

/**
 * Sparks for the study tools. Charged only after the AI succeeds, so a failed
 * generation never costs anything, and generated material is cached so the
 * student pays once per item, not per view.
 */
export const STUDY_COSTS = {
  examPrep: 20,
  lesson: 5,
  flashcards: 3,
  quiz: 3,
  truefalse: 2,
  exercises: 4,
  podcast: 8,
  mock: 15,
  oral: 15,
  mathSolve: 1,
  packSet: 4,
  topicChat: 0,
} as const;

/**
 * Sparks to AI-translate one lesson into another language.
 * Charged only after the model returns a translation, and only after the
 * editor confirms. Typing a translation by hand is free.
 */
export const LESSON_TRANSLATION_COST = 8;

export type StudyCostKey = keyof typeof STUDY_COSTS;
