/**
 * Kill switches for the community, tutor, exam, store, and snap surfaces.
 *
 * Stored at platform_settings/feature_flags. A missing document or a missing
 * key uses the default below, so a review build shows the flows and an admin
 * can turn one off without a deploy.
 */

export const FEATURE_FLAGS = [
  'community',
  'messagingHub',
  'tutorMarketplace',
  'examCentre',
  'creatorStore',
  'snapAndSolve',
  'lessonQa',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const FEATURE_FLAG_LABELS: Record<FeatureFlag, string> = {
  community: 'Community',
  messagingHub: 'Messaging hub',
  tutorMarketplace: 'Tutor marketplace',
  examCentre: 'Exam centre',
  creatorStore: 'Creator store',
  snapAndSolve: 'Snap and solve',
  lessonQa: 'Lesson Q&A',
};

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  community: true,
  messagingHub: true,
  tutorMarketplace: true,
  examCentre: true,
  creatorStore: true,
  snapAndSolve: true,
  lessonQa: true,
};

export function resolveFlags(raw: unknown): Record<FeatureFlag, boolean> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const next = { ...DEFAULT_FLAGS };
  for (const flag of FEATURE_FLAGS) {
    if (typeof source[flag] === 'boolean') next[flag] = source[flag];
  }
  return next;
}

export function isFeatureEnabled(flags: Record<FeatureFlag, boolean>, flag: FeatureFlag): boolean {
  return flags[flag] === true;
}
