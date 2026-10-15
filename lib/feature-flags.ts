/**
 * Kill switches for community, tutor, exam, store, snap, and learning surfaces.
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
  'studentGoals',
  'insights',
  'behaviour',
  'reportsHub',
  'reportCards',
  'integrityCases',
  'academicCalendar',
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
  studentGoals: 'Student goals',
  insights: 'Insights',
  behaviour: 'Behaviour',
  reportsHub: 'Reports hub',
  reportCards: 'Report cards',
  integrityCases: 'Integrity cases',
  academicCalendar: 'Academic calendar',
};

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  community: true,
  messagingHub: true,
  tutorMarketplace: true,
  examCentre: true,
  creatorStore: true,
  snapAndSolve: true,
  lessonQa: true,
  studentGoals: true,
  insights: true,
  behaviour: true,
  reportsHub: true,
  reportCards: true,
  integrityCases: true,
  academicCalendar: true,
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
