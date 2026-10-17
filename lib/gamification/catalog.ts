import { LEARNING_EVENTS, type LearningEventName } from '@/lib/events';

export type BadgeTier = 'bronze' | 'silver' | 'gold';
export type BadgeAudience = 'student' | 'parent' | 'teacher' | 'institution';

export type BadgeCriterion =
  | { type: 'once'; event: LearningEventName }
  | { type: 'count'; event: LearningEventName; atLeast: number }
  | { type: 'streak'; days: number }
  | { type: 'hour'; event: LearningEventName; from: number; to: number }
  | { type: 'metric'; event: LearningEventName; field: string; atLeast: number }
  | { type: 'xp'; atLeast: number };

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  audience: BadgeAudience;
  criteria: BadgeCriterion;
  enabled: boolean;
}

export interface LevelName {
  level: number;
  name: string;
  xp: number;
}

/** Named ranks. Programme labels stay Primary, Lower Secondary, IGCSE, and A-Level elsewhere. */
export const LEVELS: LevelName[] = [
  { level: 1, name: 'Seedling', xp: 0 },
  { level: 2, name: 'Explorer', xp: 80 },
  { level: 3, name: 'Pathfinder', xp: 200 },
  { level: 4, name: 'Scholar', xp: 500 },
  { level: 5, name: 'Mentor', xp: 1200 },
  { level: 6, name: 'Luminary', xp: 2500 },
  { level: 7, name: 'Steward', xp: 5000 },
];

export interface XpRule {
  xp: number;
  /** How many times this event can grant XP on one calendar day. */
  dailyCap: number;
}

export const GLOBAL_DAILY_XP_CAP = 120;

export const XP_RULES: Partial<Record<LearningEventName, XpRule>> = {
  [LEARNING_EVENTS.onboardingComplete]: { xp: 20, dailyCap: 1 },
  [LEARNING_EVENTS.lessonFirstComplete]: { xp: 25, dailyCap: 1 },
  [LEARNING_EVENTS.unitTestPass]: { xp: 40, dailyCap: 3 },
  [LEARNING_EVENTS.unitTestPerfect]: { xp: 15, dailyCap: 3 },
  [LEARNING_EVENTS.unitTestComeback]: { xp: 20, dailyCap: 2 },
  [LEARNING_EVENTS.studySession]: { xp: 10, dailyCap: 2 },
  [LEARNING_EVENTS.etAiQuestion]: { xp: 2, dailyCap: 10 },
  [LEARNING_EVENTS.researchHelperCited]: { xp: 15, dailyCap: 3 },
  [LEARNING_EVENTS.readsChapterFinished]: { xp: 8, dailyCap: 5 },
  [LEARNING_EVENTS.readsBookFinished]: { xp: 40, dailyCap: 2 },
  [LEARNING_EVENTS.plannerWeekKept]: { xp: 30, dailyCap: 1 },
  [LEARNING_EVENTS.peerHelp]: { xp: 12, dailyCap: 3 },
  [LEARNING_EVENTS.courseComplete]: { xp: 80, dailyCap: 2 },
  [LEARNING_EVENTS.streakDay]: { xp: 5, dailyCap: 1 },
  [LEARNING_EVENTS.teacherCoursePublished]: { xp: 40, dailyCap: 2 },
  [LEARNING_EVENTS.teacherLessonPlan]: { xp: 10, dailyCap: 5 },
  [LEARNING_EVENTS.teacherClassAllPass]: { xp: 50, dailyCap: 1 },
  [LEARNING_EVENTS.parentLinked]: { xp: 10, dailyCap: 1 },
  [LEARNING_EVENTS.institutionSetupComplete]: { xp: 25, dailyCap: 1 },
};

export interface QuestDefinition {
  id: string;
  cadence: 'daily' | 'weekly';
  title: string;
  event: LearningEventName;
  target: number;
  xp: number;
}

export const QUESTS: QuestDefinition[] = [
  { id: 'daily-session', cadence: 'daily', title: 'Study for ten minutes', event: LEARNING_EVENTS.studySession, target: 1, xp: 10 },
  { id: 'daily-question', cadence: 'daily', title: 'Ask ET AI one real question', event: LEARNING_EVENTS.etAiQuestion, target: 1, xp: 10 },
  { id: 'weekly-streak', cadence: 'weekly', title: 'Study on three days', event: LEARNING_EVENTS.streakDay, target: 3, xp: 25 },
  { id: 'weekly-unit', cadence: 'weekly', title: 'Pass a unit test', event: LEARNING_EVENTS.unitTestPass, target: 1, xp: 25 },
  { id: 'weekly-reads', cadence: 'weekly', title: 'Finish a Poket Reads chapter', event: LEARNING_EVENTS.readsChapterFinished, target: 1, xp: 25 },
];

/** Off, and zero, until a super admin turns a small grant on. */
export interface SparksRewardConfig {
  enabled: boolean;
  amount: number;
  badgeIds: string[];
}

export const DEFAULT_SPARKS: SparksRewardConfig = {
  enabled: false,
  amount: 0,
  badgeIds: [],
};

export const SPARKS_AMOUNT_MAX = 5;

export const STARTER_BADGES: BadgeDefinition[] = [
  { id: 'onboarding-complete', name: 'Ready to learn', description: 'Finish the Poket School onboarding course.', icon: 'door', tier: 'bronze', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.onboardingComplete }, enabled: true },
  { id: 'first-lesson', name: 'First lesson', description: 'Finish your first lesson.', icon: 'lesson', tier: 'bronze', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.lessonFirstComplete }, enabled: true },
  { id: 'first-unit-pass', name: 'First unit test', description: 'Pass a unit test.', icon: 'pass', tier: 'bronze', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.unitTestPass }, enabled: true },
  { id: 'perfect-score', name: 'Perfect score', description: 'Score full marks on a unit test.', icon: 'perfect', tier: 'gold', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.unitTestPerfect }, enabled: true },
  { id: 'comeback', name: 'Comeback', description: 'Pass Version B after review.', icon: 'comeback', tier: 'silver', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.unitTestComeback }, enabled: true },
  { id: 'streak-3', name: 'Three-day streak', description: 'Study three days in a row.', icon: 'flame', tier: 'bronze', audience: 'student', criteria: { type: 'streak', days: 3 }, enabled: true },
  { id: 'streak-7', name: 'Seven-day streak', description: 'Study seven days in a row.', icon: 'flame', tier: 'bronze', audience: 'student', criteria: { type: 'streak', days: 7 }, enabled: true },
  { id: 'streak-30', name: 'Thirty-day streak', description: 'Study thirty days in a row.', icon: 'flame', tier: 'silver', audience: 'student', criteria: { type: 'streak', days: 30 }, enabled: true },
  { id: 'streak-100', name: 'Hundred-day streak', description: 'Study one hundred days in a row.', icon: 'flame', tier: 'gold', audience: 'student', criteria: { type: 'streak', days: 100 }, enabled: true },
  { id: 'early-bird', name: 'Early bird', description: 'Study in the early hours.', icon: 'sunrise', tier: 'bronze', audience: 'student', criteria: { type: 'hour', event: LEARNING_EVENTS.studySession, from: 5, to: 8 }, enabled: true },
  { id: 'night-owl', name: 'Night owl', description: 'Study late in the evening.', icon: 'moon', tier: 'bronze', audience: 'student', criteria: { type: 'hour', event: LEARNING_EVENTS.studySession, from: 21, to: 24 }, enabled: true },
  { id: 'et-10', name: 'Asking ET AI', description: 'Ask ET AI ten real questions.', icon: 'chat', tier: 'bronze', audience: 'student', criteria: { type: 'count', event: LEARNING_EVENTS.etAiQuestion, atLeast: 10 }, enabled: true },
  { id: 'et-50', name: 'In conversation', description: 'Ask ET AI fifty real questions.', icon: 'chat', tier: 'silver', audience: 'student', criteria: { type: 'count', event: LEARNING_EVENTS.etAiQuestion, atLeast: 50 }, enabled: true },
  { id: 'et-100', name: 'ET AI regular', description: 'Ask ET AI one hundred real questions.', icon: 'chat', tier: 'gold', audience: 'student', criteria: { type: 'count', event: LEARNING_EVENTS.etAiQuestion, atLeast: 100 }, enabled: true },
  { id: 'curious-researcher', name: 'Curious researcher', description: 'Use Research Helper and keep the citations.', icon: 'search', tier: 'silver', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.researchHelperCited }, enabled: true },
  { id: 'reads-chapter', name: 'Chapter finished', description: 'Finish a Poket Reads chapter.', icon: 'book', tier: 'bronze', audience: 'student', criteria: { type: 'count', event: LEARNING_EVENTS.readsChapterFinished, atLeast: 1 }, enabled: true },
  { id: 'reads-book', name: 'Book finished', description: 'Finish a Poket Reads book.', icon: 'book', tier: 'silver', audience: 'student', criteria: { type: 'count', event: LEARNING_EVENTS.readsBookFinished, atLeast: 1 }, enabled: true },
  { id: 'planner-week', name: 'Plan kept', description: 'Keep the study planner for a week.', icon: 'plan', tier: 'silver', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.plannerWeekKept }, enabled: true },
  { id: 'helping-hand', name: 'Helping hand', description: 'Help a classmate with their work.', icon: 'hands', tier: 'bronze', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.peerHelp }, enabled: true },
  { id: 'level-up', name: 'Level up', description: 'Reach the next named level.', icon: 'stairs', tier: 'silver', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.levelUp }, enabled: true },
  { id: 'course-complete', name: 'Course complete', description: 'Earn a course certificate.', icon: 'certificate', tier: 'gold', audience: 'student', criteria: { type: 'once', event: LEARNING_EVENTS.courseComplete }, enabled: true },
  { id: 'parent-linked', name: 'Linked & involved', description: 'Link with your child on Poket School.', icon: 'link', tier: 'bronze', audience: 'parent', criteria: { type: 'once', event: LEARNING_EVENTS.parentLinked }, enabled: true },
  { id: 'teacher-first-course', name: 'First course published', description: 'Publish your first course.', icon: 'board', tier: 'bronze', audience: 'teacher', criteria: { type: 'once', event: LEARNING_EVENTS.teacherCoursePublished }, enabled: true },
  { id: 'teacher-plans', name: 'Lesson plans made', description: 'Make three lesson plans in ET AI Studio.', icon: 'board', tier: 'silver', audience: 'teacher', criteria: { type: 'count', event: LEARNING_EVENTS.teacherLessonPlan, atLeast: 3 }, enabled: true },
  { id: 'teacher-class-pass', name: 'Whole class passed', description: 'Every student in the class passes.', icon: 'class', tier: 'gold', audience: 'teacher', criteria: { type: 'once', event: LEARNING_EVENTS.teacherClassAllPass }, enabled: true },
  { id: 'institution-setup', name: 'School set up', description: 'Finish setting up the institution.', icon: 'school', tier: 'bronze', audience: 'institution', criteria: { type: 'once', event: LEARNING_EVENTS.institutionSetupComplete }, enabled: true },
  { id: 'institution-50', name: 'Fifty active students', description: 'Fifty students active at the school.', icon: 'school', tier: 'bronze', audience: 'institution', criteria: { type: 'metric', event: LEARNING_EVENTS.institutionActiveStudents, field: 'activeStudents', atLeast: 50 }, enabled: true },
  { id: 'institution-100', name: 'One hundred active students', description: 'One hundred students active at the school.', icon: 'school', tier: 'silver', audience: 'institution', criteria: { type: 'metric', event: LEARNING_EVENTS.institutionActiveStudents, field: 'activeStudents', atLeast: 100 }, enabled: true },
  { id: 'institution-500', name: 'Five hundred active students', description: 'Five hundred students active at the school.', icon: 'school', tier: 'gold', audience: 'institution', criteria: { type: 'metric', event: LEARNING_EVENTS.institutionActiveStudents, field: 'activeStudents', atLeast: 500 }, enabled: true },
  { id: 'first_steps', name: 'First Steps', description: 'Earn your first 100 XP.', icon: 'star', tier: 'bronze', audience: 'student', criteria: { type: 'xp', atLeast: 100 }, enabled: true },
  { id: 'rising_star', name: 'Rising Star', description: 'Earn 500 XP.', icon: 'star', tier: 'silver', audience: 'student', criteria: { type: 'xp', atLeast: 500 }, enabled: true },
  { id: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Earn 1,000 XP.', icon: 'star', tier: 'silver', audience: 'student', criteria: { type: 'xp', atLeast: 1000 }, enabled: true },
  { id: 'scholar', name: 'Scholar', description: 'Earn 5,000 XP.', icon: 'star', tier: 'gold', audience: 'student', criteria: { type: 'xp', atLeast: 5000 }, enabled: true },
  { id: 'master', name: 'Master Learner', description: 'Earn 10,000 XP.', icon: 'crown', tier: 'gold', audience: 'student', criteria: { type: 'xp', atLeast: 10000 }, enabled: true },
];

const TIERS = new Set<BadgeTier>(['bronze', 'silver', 'gold']);
const AUDIENCES = new Set<BadgeAudience>(['student', 'parent', 'teacher', 'institution']);

export function isBadgeCriterion(value: unknown): value is BadgeCriterion {
  if (!value || typeof value !== 'object') return false;
  const row = value as { type?: unknown; event?: unknown; atLeast?: unknown; days?: unknown; from?: unknown; to?: unknown; field?: unknown };
  if (row.type === 'xp') return typeof row.atLeast === 'number' && row.atLeast > 0;
  if (row.type === 'streak') return typeof row.days === 'number' && row.days > 0;
  if (row.type === 'once') return typeof row.event === 'string';
  if (row.type === 'count') return typeof row.event === 'string' && typeof row.atLeast === 'number' && row.atLeast > 0;
  if (row.type === 'metric') return typeof row.event === 'string' && typeof row.field === 'string' && typeof row.atLeast === 'number';
  if (row.type === 'hour') {
    return typeof row.event === 'string' && typeof row.from === 'number' && typeof row.to === 'number' && row.from >= 0 && row.to <= 24 && row.from < row.to;
  }
  return false;
}

/** Catalogue rows may still say `art`. Reads accept it; writes store `icon` only. */
export type BadgeDefinitionInput = Partial<BadgeDefinition> & { art?: string };

export function badgeIcon(row: { icon?: unknown; art?: unknown } | null | undefined): string {
  const icon = typeof row?.icon === 'string' ? row.icon.trim() : '';
  if (icon) return icon.slice(0, 32);
  const art = typeof row?.art === 'string' ? row.art.trim() : '';
  if (art) return art.slice(0, 32);
  return '';
}

export function mergeDefinitions(overrides: readonly BadgeDefinitionInput[] | null | undefined): BadgeDefinition[] {
  const map = new Map(STARTER_BADGES.map(badge => [badge.id, badge]));
  for (const extra of overrides ?? []) {
    if (!extra || typeof extra.id !== 'string' || !/^[a-z0-9_-]{3,48}$/.test(extra.id)) continue;
    if (extra.criteria && !isBadgeCriterion(extra.criteria)) continue;
    const base = map.get(extra.id);
    const icon = badgeIcon(extra) || base?.icon || 'star';
    const next: BadgeDefinition = {
      id: extra.id,
      name: typeof extra.name === 'string' && extra.name.trim() ? extra.name.trim().slice(0, 80) : base?.name ?? extra.id,
      description: typeof extra.description === 'string' && extra.description.trim() ? extra.description.trim().slice(0, 180) : base?.description ?? '',
      icon,
      tier: extra.tier && TIERS.has(extra.tier) ? extra.tier : base?.tier ?? 'bronze',
      audience: extra.audience && AUDIENCES.has(extra.audience) ? extra.audience : base?.audience ?? 'student',
      criteria: extra.criteria && isBadgeCriterion(extra.criteria) ? extra.criteria : base?.criteria ?? { type: 'once', event: LEARNING_EVENTS.onboardingComplete },
      enabled: typeof extra.enabled === 'boolean' ? extra.enabled : base?.enabled ?? true,
    };
    map.set(next.id, next);
  }
  return [...map.values()];
}

export function levelForXp(xp: number): { level: number; name: string; progress: number; nextName: string | null; intoNext: number } {
  const safe = Math.max(0, Math.floor(xp));
  let current = LEVELS[0] ?? { level: 1, name: 'Seedling', xp: 0 };
  for (const row of LEVELS) {
    if (safe >= row.xp) current = row;
  }
  const next = LEVELS.find(row => row.xp > current.xp) ?? null;
  const span = next ? next.xp - current.xp : 1;
  const progress = next ? Math.min(100, Math.round(((safe - current.xp) / span) * 100)) : 100;
  return {
    level: current.level,
    name: current.name,
    progress,
    nextName: next?.name ?? null,
    intoNext: next ? next.xp - safe : 0,
  };
}
