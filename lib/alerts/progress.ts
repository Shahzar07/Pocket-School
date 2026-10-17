/**
 * Learning-progress early warnings. The function takes facts the server
 * already loaded. It does not invent lessons, scores, or people.
 */

import type { SlaWindows } from './accountability';
import {
  maxSeverity,
  severityAtLeast,
  type AlertSeverity,
} from './model';

export const PROGRESS_SIGNAL_IDS = [
  'failed_unit_test',
  'failed_retake',
  'score_drop',
  'behind_pace',
  'inactivity',
  'broken_streak',
  'overdue_assignment',
  'low_mastery',
  'time_anomaly',
  'repeated_lesson_failure',
  'final_at_risk',
  'engagement_collapse',
] as const;

export type ProgressSignalId = (typeof PROGRESS_SIGNAL_IDS)[number];

export interface ProgressThresholds {
  inactiveLowDays: number;
  inactiveMediumDays: number;
  inactiveHighDays: number;
  inactiveCriticalDays: number;
  scoreDropPercent: number;
  finalAtRiskPercent: number;
  /** Completed / expected at or below this, once two lessons were expected, is "well behind". */
  paceBehindRatio: number;
  bloomLowPercent: number;
  /** Latest session versus the student's own median. */
  timeAnomalyRatio: number;
  repeatedFails: number;
  multipleUnitsFailed: number;
}

export interface ProgressSettings {
  thresholds: ProgressThresholds;
  parentAlertLevel: AlertSeverity;
  quietStart: string;
  quietEnd: string;
  automationEnabled: boolean;
  academicLeadIds: string[];
  sla: SlaWindows;
}

export const DEFAULT_THRESHOLDS: ProgressThresholds = {
  inactiveLowDays: 3,
  inactiveMediumDays: 7,
  inactiveHighDays: 14,
  inactiveCriticalDays: 30,
  scoreDropPercent: 15,
  finalAtRiskPercent: 70,
  paceBehindRatio: 0.5,
  bloomLowPercent: 50,
  timeAnomalyRatio: 3,
  repeatedFails: 2,
  multipleUnitsFailed: 2,
};

export interface UnitAttemptFact {
  lessonId: string;
  unitTitle: string;
  version: 'A' | 'B';
  passed: boolean;
  percentage: number;
}

export interface NamedLesson {
  lessonId: string;
  title: string;
}

export interface VisualFact {
  lessonId: string;
  title: string;
  kind: 'revisionPoster' | 'mindmapImage';
  src: string;
}

export interface BloomFact {
  level: string;
  /** 0–100. Only levels with attempts are considered. */
  score: number;
  attempts: number;
}

export interface AssignmentFact {
  id: string;
  title: string;
  dueAt: number;
  submitted: boolean;
}

export interface LearnerFacts {
  studentId: string;
  studentName: string;
  /** Named level: Primary, Lower Secondary, IGCSE, A-Level. */
  level: string;
  courseId: string;
  courseTitle: string;
  institutionId: string | null;
  teacherIds: string[];
  adult: boolean;
  /** Adult with no institution. Self-alerts only. */
  independent: boolean;
  now: number;
  lastLessonAt: number | null;
  streakDays: number;
  previousStreakDays: number;
  lessonsExpected: number;
  lessonsCompleted: number;
  /** Latest attempt per unit test lesson, newest last in the source list. */
  unitAttempts: UnitAttemptFact[];
  /** Percentages used for the student's own average. Excludes the latest point. */
  priorScores: number[];
  latestScore: number | null;
  assignments: AssignmentFact[];
  bloom: BloomFact[];
  /** Recent session minutes, oldest first. The last value is the latest session. */
  sessionMinutes: number[];
  /** Fail count per lesson id. Titles must already be known. */
  lessonFailures: { lessonId: string; title: string; fails: number }[];
  /** 0–100 projected course final. Null when there is no projection. */
  projectedFinal: number | null;
  safeguardingCaseId: string | null;
  reviewLessons: NamedLesson[];
  visuals: VisualFact[];
  /** Severity of the open progress alert, if one is still open. */
  openSeverity: AlertSeverity | null;
}

export interface ProgressSignal {
  id: ProgressSignalId;
  severity: AlertSeverity;
  detail: string;
}

export interface RecoveryPlan {
  studentIntro: string;
  review: NamedLesson[];
  targeted: NamedLesson[];
  visuals: VisualFact[];
  retake: string;
  parentGuide: string;
  teacherActions: string[];
}

export interface ProgressEvaluation {
  severity: AlertSeverity | null;
  signals: ProgressSignal[];
  positive: PositiveKind | null;
  badge: 'comeback' | null;
  plan: RecoveryPlan;
}

export type PositiveKind = 'recovered' | 'streak_restored' | 'improvement' | 'comeback';

export interface DeliveryPlan {
  studentNudge: boolean;
  parentDigest: boolean;
  parentPush: boolean;
  teacherPush: boolean;
  leadPush: boolean;
  parentEmail: boolean;
  teacherEmail: boolean;
  leadEmail: boolean;
  /** Non-critical notices wait until quiet hours end. */
  heldForQuietHours: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function mergeThresholds(partial: Partial<ProgressThresholds> | null | undefined): ProgressThresholds {
  const next = { ...DEFAULT_THRESHOLDS };
  if (!partial) return next;
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof ProgressThresholds)[]) {
    const value = partial[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) next[key] = value;
  }
  return next;
}

function daysSince(at: number | null, now: number): number | null {
  if (at == null || !Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? 0;
    const right = sorted[mid] ?? 0;
    return (left + right) / 2;
  }
  return sorted[mid] ?? null;
}

function latestByLesson(attempts: readonly UnitAttemptFact[]): UnitAttemptFact[] {
  const map = new Map<string, UnitAttemptFact>();
  for (const attempt of attempts) map.set(attempt.lessonId, attempt);
  return [...map.values()];
}

export function evaluateProgress(facts: LearnerFacts, thresholds: ProgressThresholds = DEFAULT_THRESHOLDS): ProgressEvaluation {
  const signals: ProgressSignal[] = [];
  const limits = mergeThresholds(thresholds);
  const latest = latestByLesson(facts.unitAttempts);
  const failed = latest.filter((attempt) => !attempt.passed);
  const failedB = failed.filter((attempt) => attempt.version === 'B');
  const failedA = failed.filter((attempt) => attempt.version === 'A');

  if (failedB.length > 0) {
    const name = failedB[0]?.unitTitle || 'a unit';
    signals.push({
      id: 'failed_retake',
      severity: 'medium',
      detail: `${facts.studentName} did not pass the Version B retake for ${name}.`,
    });
  } else if (failedA.length > 0) {
    const name = failedA[0]?.unitTitle || 'a unit';
    signals.push({
      id: 'failed_unit_test',
      severity: 'low',
      detail: `${facts.studentName} did not pass Version A for ${name}.`,
    });
  }

  if (failed.length >= limits.multipleUnitsFailed) {
    signals.push({
      id: 'failed_unit_test',
      severity: 'high',
      detail: `${failed.length} units are still unpassed.`,
    });
  }

  if (facts.latestScore != null && facts.priorScores.length > 0) {
    const average = facts.priorScores.reduce((sum, score) => sum + score, 0) / facts.priorScores.length;
    const drop = average - facts.latestScore;
    if (drop >= limits.scoreDropPercent) {
      signals.push({
        id: 'score_drop',
        severity: 'medium',
        detail: `The latest score is ${Math.round(facts.latestScore)}%, ${Math.round(drop)} points under ${facts.studentName}'s own average of ${Math.round(average)}%.`,
      });
    }
  }

  if (facts.lessonsExpected >= 2 && facts.lessonsCompleted < facts.lessonsExpected * limits.paceBehindRatio) {
    signals.push({
      id: 'behind_pace',
      severity: 'high',
      detail: `${facts.lessonsCompleted} of ${facts.lessonsExpected} lessons expected for ${facts.level || 'this level'} are complete.`,
    });
  } else if (facts.lessonsExpected >= 1 && facts.lessonsCompleted < facts.lessonsExpected) {
    signals.push({
      id: 'behind_pace',
      severity: 'low',
      detail: `${facts.lessonsCompleted} of ${facts.lessonsExpected} lessons expected for ${facts.level || 'this level'} are complete.`,
    });
  }

  const inactive = daysSince(facts.lastLessonAt, facts.now);
  if (inactive != null) {
    let severity: AlertSeverity | null = null;
    if (inactive >= limits.inactiveCriticalDays) severity = 'critical';
    else if (inactive >= limits.inactiveHighDays) severity = 'high';
    else if (inactive >= limits.inactiveMediumDays) severity = 'medium';
    else if (inactive >= limits.inactiveLowDays) severity = 'low';
    if (severity) {
      signals.push({
        id: 'inactivity',
        severity,
        detail: `${inactive} days since the last lesson in ${facts.courseTitle || 'this course'}.`,
      });
    }
  }

  if (facts.streakDays === 0 && facts.previousStreakDays >= 3) {
    signals.push({
      id: 'broken_streak',
      severity: 'low',
      detail: `The ${facts.previousStreakDays}-day streak has stopped.`,
    });
  }

  const overdue = facts.assignments.filter((item) => !item.submitted && item.dueAt < facts.now);
  if (overdue.length > 0) {
    signals.push({
      id: 'overdue_assignment',
      severity: overdue.length >= 3 ? 'medium' : 'low',
      detail: overdue.map((item) => item.title).join(', '),
    });
  }

  const weakBloom = facts.bloom.filter((item) => item.attempts >= 2 && item.score < limits.bloomLowPercent);
  if (weakBloom.length > 0) {
    signals.push({
      id: 'low_mastery',
      severity: weakBloom.length >= 3 ? 'high' : 'low',
      detail: weakBloom.map((item) => `${item.level} ${Math.round(item.score)}%`).join(', '),
    });
  }

  if (facts.sessionMinutes.length >= 4) {
    const latestMinutes = facts.sessionMinutes[facts.sessionMinutes.length - 1] ?? 0;
    const typical = median(facts.sessionMinutes.slice(0, -1));
    if (typical != null && typical > 0) {
      const high = latestMinutes >= typical * limits.timeAnomalyRatio;
      const low = latestMinutes <= typical / limits.timeAnomalyRatio;
      if (high || low) {
        signals.push({
          id: 'time_anomaly',
          severity: 'low',
          detail: `Latest session ${Math.round(latestMinutes)} minutes, own typical ${Math.round(typical)} minutes.`,
        });
      }
    }
  }

  const repeated = facts.lessonFailures.filter((item) => item.fails >= limits.repeatedFails);
  if (repeated.length > 0) {
    const worst = repeated.reduce((best, item) => (item.fails > best.fails ? item : best), repeated[0]!);
    signals.push({
      id: 'repeated_lesson_failure',
      severity: worst.fails >= limits.repeatedFails + 1 ? 'high' : 'medium',
      detail: `${worst.title} (${worst.lessonId}) has ${worst.fails} unsuccessful attempts.`,
    });
  }

  if (facts.projectedFinal != null && facts.projectedFinal < limits.finalAtRiskPercent) {
    signals.push({
      id: 'final_at_risk',
      severity: 'critical',
      detail: `Projected course result is ${Math.round(facts.projectedFinal)}%, under ${limits.finalAtRiskPercent}%.`,
    });
  }

  const collapsed = signals.some((signal) => signal.id === 'time_anomaly')
    && facts.sessionMinutes.length >= 4
    && (facts.sessionMinutes[facts.sessionMinutes.length - 1] ?? 0) < (median(facts.sessionMinutes.slice(0, -1)) ?? 0) / limits.timeAnomalyRatio;
  if (collapsed && facts.safeguardingCaseId) {
    signals.push({
      id: 'engagement_collapse',
      severity: 'critical',
      detail: `Engagement dropped suddenly and safeguarding case ${facts.safeguardingCaseId} is open.`,
    });
  }

  const severity = maxSeverity(signals.map((signal) => signal.severity));
  const positive = positiveKind(facts, severity);
  return {
    severity,
    signals,
    positive: severity ? null : positive,
    badge: !severity && (positive === 'comeback' || (facts.openSeverity === 'high' || facts.openSeverity === 'critical')) ? 'comeback' : null,
    plan: buildRecoveryPlan(facts, severity),
  };
}

function positiveKind(facts: LearnerFacts, severity: AlertSeverity | null): PositiveKind | null {
  if (severity) return null;
  if (facts.openSeverity === 'high' || facts.openSeverity === 'critical') return 'comeback';
  if (facts.openSeverity) return 'recovered';
  if (facts.streakDays >= 3 && facts.previousStreakDays === 0) return 'streak_restored';
  if (facts.latestScore != null && facts.priorScores.length > 0) {
    const average = facts.priorScores.reduce((sum, score) => sum + score, 0) / facts.priorScores.length;
    if (facts.latestScore >= average + 10) return 'improvement';
  }
  return null;
}

export function buildRecoveryPlan(facts: LearnerFacts, severity: AlertSeverity | null): RecoveryPlan {
  const known = new Map(facts.reviewLessons.map((lesson) => [lesson.lessonId, lesson]));
  const review = facts.reviewLessons.filter((lesson) => lesson.lessonId && lesson.title);
  const targeted = review.slice(0, 3);
  const visuals = facts.visuals.filter((item) => {
    if (!item.src || !item.lessonId || !item.title) return false;
    if (item.kind !== 'revisionPoster' && item.kind !== 'mindmapImage') return false;
    return known.has(item.lessonId) || review.some((lesson) => lesson.lessonId === item.lessonId);
  });
  const failedB = latestByLesson(facts.unitAttempts).some((attempt) => !attempt.passed && attempt.version === 'B');
  const failedA = latestByLesson(facts.unitAttempts).some((attempt) => !attempt.passed && attempt.version === 'A');
  let retake = 'No unit-test retake is waiting on the record.';
  if (failedB) retake = 'Finish the review lessons, then the next paper is Version A.';
  else if (failedA) retake = 'Finish the review lessons, then the retake is Version B.';

  const first = targeted[0]?.title;
  const studentIntro = studentTone(severity, first);
  const parentGuide = facts.adult
    ? ''
    : parentTone(facts, severity, review);
  const teacherActions = teacherTone(facts, severity, review);
  return { studentIntro, review, targeted, visuals, retake, parentGuide, teacherActions };
}

function studentTone(severity: AlertSeverity | null, first: string | undefined): string {
  if (!severity) {
    return first
      ? `Nice work staying with it. ${first} is on your list if you want another pass.`
      : 'You are in a good spot. Keep the next lesson small and finish it.';
  }
  if (severity === 'low') {
    return first
      ? `A short review will help. Start with ${first} when you are ready.`
      : 'A short review will help. Open the next lesson when you are ready.';
  }
  if (severity === 'medium') {
    return first
      ? `Picking this up today will help. Start with ${first}.`
      : 'Picking this up today will help. Start with the next lesson on the course.';
  }
  if (severity === 'high') {
    return first
      ? `One lesson at a time is enough. Start with ${first}. Your teacher can see this too.`
      : 'One lesson at a time is enough. Your teacher can see this too.';
  }
  return first
    ? `You are not on your own. Start with ${first}. Your teacher has the rest of the plan.`
    : 'You are not on your own. Open the course and start the next lesson. Your teacher has the rest of the plan.';
}

function parentTone(facts: LearnerFacts, severity: AlertSeverity | null, review: NamedLesson[]): string {
  const level = facts.level || 'their level';
  const course = facts.courseTitle || 'the course';
  if (!severity) return `${facts.studentName} is back on track in ${course}.`;
  const next = review[0]?.title;
  const step = next ? ` The next lesson on record is ${next}.` : '';
  if (severity === 'low') return `${facts.studentName} is slipping slightly in ${course} (${level}). A quiet check-in this week is enough.${step}`;
  if (severity === 'medium') return `${facts.studentName} needs a same-day look at ${course} (${level}).${step}`;
  if (severity === 'high') return `${facts.studentName} is well behind the pace of ${course} (${level}). Agree one lesson tonight.${step}`;
  return `${facts.studentName} is at risk in ${course} (${level}). Contact the teacher and start with the first review lesson.${step}`;
}

function teacherTone(facts: LearnerFacts, severity: AlertSeverity | null, review: NamedLesson[]): string[] {
  const actions: string[] = [];
  if (review[0]) actions.push(`Assign a review of ${review[0].title} (${review[0].lessonId}).`);
  if (severity === 'high' || severity === 'critical') actions.push('Book a short intervention before the next live class.');
  if (severity === 'critical' && facts.safeguardingCaseId) {
    actions.push(`Read safeguarding case ${facts.safeguardingCaseId} before you message the family.`);
  }
  if (facts.projectedFinal != null && severity === 'critical') {
    actions.push(`Projected result is ${Math.round(facts.projectedFinal)}%. Confirm the course final plan.`);
  }
  if (actions.length === 0) actions.push('No extra teacher action is on the record.');
  return actions;
}

export function isQuietMinutes(minutesNow: number, start: string, end: string): boolean {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from == null || to == null || from === to) return false;
  const minute = ((minutesNow % (24 * 60)) + 24 * 60) % (24 * 60);
  if (from < to) return minute >= from && minute < to;
  return minute >= from || minute < to;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function planDelivery(input: {
  severity: AlertSeverity;
  adult: boolean;
  independent: boolean;
  parentMinimum: AlertSeverity;
  quiet: boolean;
  digestDay: boolean;
}): DeliveryPlan {
  const parentsAllowed = !input.adult && !input.independent && severityAtLeast(input.severity, input.parentMinimum);
  const staff = !input.independent;
  const critical = input.severity === 'critical';
  const held = input.quiet && !critical;
  const low = input.severity === 'low';
  const medium = input.severity === 'medium';
  const high = input.severity === 'high';
  return {
    studentNudge: true,
    parentDigest: parentsAllowed && low && input.digestDay && !held,
    parentPush: parentsAllowed && (medium || high || critical) && !held,
    teacherPush: staff && (medium || high || critical) && !held,
    leadPush: staff && (high || critical) && !held,
    parentEmail: parentsAllowed && critical,
    teacherEmail: staff && critical,
    leadEmail: staff && critical,
    heldForQuietHours: held && (low || medium || high),
  };
}

export interface LevelCount {
  level: string;
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/** Aggregate insights hide groups smaller than five. */
export function aggregateLevels(
  rows: readonly { level: string; severity: AlertSeverity }[],
  minimum = 5,
): LevelCount[] {
  const groups = new Map<string, LevelCount>();
  for (const row of rows) {
    const level = row.level || 'Unassigned';
    const current = groups.get(level) ?? { level, total: 0, low: 0, medium: 0, high: 0, critical: 0 };
    current.total += 1;
    current[row.severity] += 1;
    groups.set(level, current);
  }
  return [...groups.values()].filter((group) => group.total >= minimum);
}

export function shouldAutoResolve(evaluation: ProgressEvaluation): boolean {
  return evaluation.severity == null;
}

/** Client-safe alert card. The server writes this shape. */
export interface ProgressAlertView {
  id: string;
  type: 'progress';
  polarity: 'concern' | 'positive';
  severity: AlertSeverity;
  status: 'open' | 'acknowledged' | 'assigned' | 'resolved';
  studentId: string;
  studentName: string;
  adult: boolean;
  level: string;
  courseId: string;
  courseTitle: string;
  institutionId: string | null;
  title: string;
  summary: string;
  signals: ProgressSignal[];
  plan: RecoveryPlan;
  safeguardingCaseId: string | null;
  assigneeId: string | null;
  badge: 'comeback' | null;
  positive: PositiveKind | null;
  notes: { at: number; authorName: string; text: string }[];
  audit: { at: number; action: string; detail: string }[];
  streakDays: number;
  createdAt: number;
  accountability: {
    ownerName: string;
    coOwnerName: string;
    dueAt: number | null;
    acknowledgedAt: number | null;
    actedAt: number | null;
    parentSeenAt: number | null;
    parentActedAt: number | null;
    staffAction: string | null;
    parentAction: string | null;
    overdue: boolean;
    tasks: { id: string; who: 'student' | 'parent' | 'teacher'; text: string; dueAt: number | null; doneAt: number | null }[];
    agenda: string;
    meeting: { provider: 'zoom' | 'meet' | 'teams'; url: string; at: number | null; agenda: string } | null;
    teacherStep: number;
    parentStep: number;
    recognition: string[];
  } | null;
  updatedAt: number;
  resolvedAt: number | null;
  autoResolved: boolean;
}
