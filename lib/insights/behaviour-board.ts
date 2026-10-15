/**
 * Behaviour charts share the report snapshot. A figure on this board is the
 * same figure as Reports: consistency, streak, focus, cramming, hints, pace.
 */

import { buildSnapshot, type AnalyticsSnapshot, type SnapshotInput } from './aggregate';
import { dropOffPoints, hourHeatmap, type QuizPoint, type StudyBar, type StudyEvent } from './analytics';
import {
  engagementQuadrant, MOOD_LABELS, QUADRANT_LABELS, type Anomaly, type FocusSessionLike, type Mood, type Quadrant,
} from './behaviour';
import { dateKeysBetween } from './dates';
import { startedLate, type GoalLike } from './goals';
import type { DrillRecord } from './reports';

export type BehaviourRole = 'student' | 'parent' | 'teacher' | 'institution_admin';

export interface MoodCheck {
  dateKey: string;
  mood: Mood;
  effort?: number;
  at: string;
}

export interface BehaviourNote {
  id: string;
  studentId: string;
  studentLabel: string;
  type: 'merit' | 'demerit' | 'commendation' | 'warning' | 'note';
  points: number;
  description: string;
  at: string;
}

export interface Classmate {
  studentId: string;
  label: string;
  studyMinutes: number;
  performance: number | null;
}

export interface SessionBucket {
  id: string;
  label: string;
  count: number;
  records: DrillRecord[];
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: 'cramming' | 'procrastination' | 'drop-off';
  label: string;
  detail: string;
}

export interface BehaviourBadge {
  id: string;
  title: string;
  detail: string;
}

export interface BehaviourBoardModel {
  role: BehaviourRole;
  scopeLabel: string;
  computedAt: string;
  precomputed: boolean;
  snapshot: AnalyticsSnapshot;
  heatmap: number[][];
  calendar: { dateKey: string; studied: boolean; completed: boolean }[];
  sessions: SessionBucket[];
  focusRecords: DrillRecord[];
  timeline: TimelineEvent[];
  helpRecords: DrillRecord[];
  funnel: { start: number; progress: number; complete: number; records: DrillRecord[] };
  moods: MoodCheck[];
  badges: BehaviourBadge[];
  notes: BehaviourNote[];
  classPoints: { studentId: string; label: string; studyMinutes: number; performance: number | null; quadrant: Quadrant | null }[];
  captions: Record<string, string>;
}

export interface BehaviourInput {
  role: BehaviourRole;
  scopeLabel: string;
  computedAt: string;
  precomputed?: boolean;
  now: Date;
  snapshotInput: SnapshotInput;
  focusSessions: (FocusSessionLike & { at?: string; goalId?: string })[];
  moods: MoodCheck[];
  notes: BehaviourNote[];
  classmates?: Classmate[];
  courseProgress?: { label: string; progress: number }[];
  /** Class view already lists every student in classmates. */
  omitSelf?: boolean;
}

const BUCKETS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'short', label: 'Up to 15 min', min: 0, max: 15 },
  { id: 'pomodoro', label: '16–25 min', min: 16, max: 25 },
  { id: 'study', label: '26–45 min', min: 26, max: 45 },
  { id: 'long', label: 'Over 45 min', min: 46, max: Number.POSITIVE_INFINITY },
];

function record(id: string, when: string, label: string, value: string): DrillRecord {
  return { id, when, label, value };
}

function inWindow(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export function sessionBuckets(events: StudyEvent[], start: string, end: string): SessionBucket[] {
  const rows = events.filter(event => {
    const day = event.at?.slice(0, 10) ?? '';
    return event.minutes > 0 && (!day || inWindow(day, start, end));
  });
  return BUCKETS.map(bucket => {
    const matched = rows.filter(event => event.minutes >= bucket.min && event.minutes <= bucket.max);
    return {
      id: bucket.id,
      label: bucket.label,
      count: matched.length,
      records: matched.map((event, index) => record(`session-${bucket.id}-${index}`, event.at ?? '', event.courseId || 'Study session', `${event.minutes} min`)),
    };
  });
}

export function engagementFunnel(goals: GoalLike[], start: string, end: string): BehaviourBoardModel['funnel'] {
  const rows = goals.filter(goal => inWindow(goal.dateKey, start, end));
  const records = rows.map(goal => record(goal.id ?? `${goal.dateKey}-${goal.title}`, goal.dateKey, goal.title, goal.status));
  return {
    start: rows.length,
    progress: rows.filter(goal => goal.status === 'in_progress').length,
    complete: rows.filter(goal => goal.status === 'completed').length,
    records,
  };
}

export function positiveBadges(input: { merits: number; streak: number; adherence: number | null; completed: number }): BehaviourBadge[] {
  const badges: BehaviourBadge[] = [];
  if (input.merits > 0) badges.push({ id: 'merit', title: 'Merit', detail: `${input.merits} merit or commendation from a teacher.` });
  if (input.streak >= 3) badges.push({ id: 'streak', title: 'Three-day streak', detail: 'Goals were completed three days in a row. This is the Reports streak.' });
  if (input.adherence != null && input.adherence >= 80) badges.push({ id: 'focus', title: 'Focus kept', detail: 'Actual focus time reached at least 80% of the plan.' });
  if (input.completed >= 3) badges.push({ id: 'finish', title: 'Finished the set', detail: `${input.completed} goals completed in this range.` });
  return badges;
}

export function behaviourAlertMessages(anomalies: Anomaly[], studentName: string): { title: string; message: string; pref: Anomaly['pref']; link: string }[] {
  return anomalies
    .filter(item => item.id === 'study-drop' || item.id === 'cramming')
    .map(item => ({
      title: item.title,
      message: `${studentName}: ${item.detail}`,
      pref: item.pref,
      link: '/dashboard/behaviour',
    }));
}

function crammingEvents(events: StudyEvent[], deadlinesMs: number[]): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  events.forEach((event, index) => {
    if (!event.at) return;
    const t = new Date(event.at).getTime();
    if (Number.isNaN(t)) return;
    const close = deadlinesMs.some(atMs => t <= atMs && atMs - t <= 86_400_000 && atMs - t >= 0);
    if (!close) return;
    out.push({
      id: `cram-${index}`,
      at: event.at,
      kind: 'cramming',
      label: 'Study packed against a deadline',
      detail: `${event.minutes} min inside the day before a deadline.`,
    });
  });
  return out;
}

export function buildBehaviourBoard(input: BehaviourInput): BehaviourBoardModel {
  const snapshot = buildSnapshot({
    ...input.snapshotInput,
    now: input.now,
    computedAt: input.computedAt,
    courseProgress: input.courseProgress ?? input.snapshotInput.courseProgress,
  });
  const start = snapshot.rangeStart;
  const end = snapshot.rangeEnd;
  const events = input.snapshotInput.studyEvents;
  const goals = input.snapshotInput.goals;
  const studiedDays = new Set(events.map(event => event.at?.slice(0, 10)).filter((day): day is string => !!day && inWindow(day, start, end)));
  const calendar = dateKeysBetween(start, end).map(dateKey => {
    const day = goals.filter(goal => goal.dateKey === dateKey);
    return {
      dateKey,
      studied: studiedDays.has(dateKey),
      completed: day.length > 0 && day.every(goal => goal.status === 'completed' || goal.status === 'excused'),
    };
  });
  const funnel = engagementFunnel(goals, start, end);
  const merits = input.notes.filter(note => note.type === 'merit' || note.type === 'commendation').length;
  const series = snapshot.studySeries as StudyBar[];
  const drops = dropOffPoints(input.courseProgress ?? [], series);
  const lateGoals = goals.filter(goal => inWindow(goal.dateKey, start, end) && startedLate(goal));
  const timeline: TimelineEvent[] = [
    ...crammingEvents(events, input.snapshotInput.deadlinesMs),
    ...lateGoals.map(goal => ({
      id: `late-${goal.id ?? goal.dateKey}`,
      at: goal.dateKey,
      kind: 'procrastination' as const,
      label: goal.title,
      detail: 'Work started in the last fifth of the goal window.',
    })),
    ...drops.map((detail, index) => ({
      id: `drop-${index}`,
      at: end,
      kind: 'drop-off' as const,
      label: 'Drop-off',
      detail,
    })),
  ];
  const quizzes = input.snapshotInput.quizzes.filter(quiz => inWindow(quiz.at.slice(0, 10), start, end));
  const staff = input.role === 'teacher' || input.role === 'institution_admin';
  const selfPoint = {
    studentId: input.snapshotInput.scopeId,
    label: input.scopeLabel,
    studyMinutes: snapshot.metrics.study_time ?? 0,
    performance: snapshot.metrics.quiz_average,
  };
  const classPoints = (staff
    ? [...(input.omitSelf ? [] : [selfPoint]), ...(input.classmates ?? [])]
    : [selfPoint]).map(point => ({
    ...point,
    quadrant: engagementQuadrant(point.studyMinutes, point.performance),
  }));
  return {
    role: input.role,
    scopeLabel: input.scopeLabel,
    computedAt: input.computedAt,
    precomputed: input.precomputed === true,
    snapshot,
    heatmap: hourHeatmap(events),
    calendar,
    sessions: sessionBuckets(events, start, end),
    focusRecords: input.focusSessions.map((session, index) => record(session.goalId ?? `focus-${index}`, session.at ?? end, 'Focus timer', `${session.actualMinutes}/${session.plannedMinutes} min`)),
    timeline,
    helpRecords: quizzes.map((quiz, index) => record(quiz.lessonId ?? `quiz-${index}`, quiz.at, quiz.topic || 'Question', `${quiz.attempts ?? '—'} attempts · ${quiz.seconds ?? '—'}s`)),
    funnel,
    moods: [...input.moods].filter(mood => inWindow(mood.dateKey, start, end)).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    badges: positiveBadges({
      merits,
      streak: snapshot.metrics.streak ?? 0,
      adherence: snapshot.metrics.focus_adherence,
      completed: funnel.complete,
    }),
    notes: [...input.notes].sort((a, b) => a.at.localeCompare(b.at)),
    classPoints,
    captions: {
      heatmap: 'Each cell is minutes studied that weekday and hour. Sunday is the first row. This is the same study-time total as Reports.',
      consistency: 'How even the daily minutes are. A high score means study is spread through the range, not saved for one day.',
      streak: 'Days in a row where every goal was completed or excused. A day with no goals does not break it. Same streak as Reports.',
      sessions: 'How long each study session lasted. The buckets count the same study events as study time.',
      focus: 'Actual focus-timer minutes divided by the minutes that were planned.',
      timeline: 'Cramming is study in the 24 hours before a deadline. Procrastination is a late start. Drop-offs are courses that stall or days where study falls sharply.',
      help: 'Hint rate is hints divided by questions. Attempts and seconds per question are the means on the quiz rows.',
      funnel: 'Start is every goal in the range. Progress is still in progress. Complete is finished. Goal completion on Reports uses completed ÷ (completed + missed).',
      mood: 'Optional emoji after a session. Effort is a separate 1–5 mark and is not part of the mood label.',
      badges: 'Badges mark merits, a streak of at least three, focus at or above 80%, and three completed goals.',
      notes: 'Merits and concerns a teacher wrote. Points are the teacher’s scale, not a Reports metric.',
      quadrant: 'Engaged means at least 60 study minutes. Strong means a quiz average of at least 70. Needs a closer look is the at-risk corner.',
      alerts: 'A sudden drop is study time under half the previous range, when that range had at least 30 minutes.',
    },
  };
}

export function moodLabel(mood: Mood): string {
  return MOOD_LABELS[mood];
}

export function quadrantLabel(quadrant: Quadrant | null): string {
  return quadrant ? QUADRANT_LABELS[quadrant] : 'Needs study time and a quiz score.';
}

export function heatmapCell(grid: number[][], weekday: number, hour: number): number {
  return grid[weekday]?.[hour] ?? 0;
}

export type { QuizPoint };
