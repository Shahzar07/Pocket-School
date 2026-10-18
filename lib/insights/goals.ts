/**
 * Learning goals. The fields a mobile DailyGoal already stores stay required.
 * Everything else is optional so an older app build keeps reading the same
 * documents. Sparks amounts come from lib/sparks.ts.
 */

import { GOAL_ON_TIME_BONUS, GOAL_STREAK_BONUS } from '../sparks';
import { addDays, isoDateKey, parseDateKey, weekdayOf } from './dates';

export type GoalCategory = 'study' | 'homework' | 'revision' | 'reading' | 'practice' | 'personal' | 'other';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'excused';
export type GoalRecurrence = 'none' | 'daily' | 'weekdays' | 'weekly';
export type GoalTargetKind = 'free_text' | 'unit' | 'lessons' | 'revision' | 'quiz_score' | 'studio';
export type GoalSource = 'student' | 'self' | 'parent' | 'ai' | 'et_ai' | 'teacher';
export type GoalPriority = 'low' | 'medium' | 'high';

export interface GoalReaction {
  parentId: string;
  emoji: string;
  at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/** Shape the streak and progress helpers need. DailyGoal in lib/db.ts satisfies it. */
export interface GoalLike {
  id?: string;
  studentId?: string;
  dateKey: string;
  title: string;
  category?: GoalCategory;
  estimateMinutes?: number;
  deadline?: string;
  status: GoalStatus | string;
  actualMinutes?: number;
  targetKind?: GoalTargetKind;
  unitId?: string;
  unitTitle?: string;
  lessonIds?: string[];
  freeTextTarget?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: GoalRecurrence;
  checklist?: ChecklistItem[];
  reminderMinutes?: number;
  reflection?: string;
  progress?: number;
  source?: GoalSource;
  createdAtMs?: number;
  startedAtMs?: number;
  completedLessonIds?: string[];
  quizScore?: number;
  priority?: GoalPriority;
  reminderTime?: string;
  quizTarget?: number;
  studioTask?: string;
  shareWithTeachers?: boolean;
  teacherIds?: string[];
  reactions?: GoalReaction[];
  pomodoroWork?: number;
  pomodoroBreak?: number;
  reflectionPrompt?: string;
  sparksBonus?: number;
  reward?: string;
  courseId?: string;
  courseLabel?: string;
  lessonTitles?: string[];
}

export interface ProgressEvent {
  kind: 'lesson' | 'quiz';
  lessonId?: string;
  unitId?: string;
  scorePercent?: number;
}

export interface GoalDraft {
  title: string;
  category: GoalCategory;
  estimateMinutes: number;
  deadline: string;
  dateKey: string;
  endDate?: string;
  recurrence: GoalRecurrence;
  targetKind: GoalTargetKind;
  freeTextTarget?: string;
  unitId?: string;
  unitTitle?: string;
  lessonIds?: string[];
  courseId?: string;
  courseLabel?: string;
  checklist: ChecklistItem[];
  reminderMinutes?: number;
  priority?: GoalPriority;
  reminderTime?: string;
  quizTarget?: number;
  studioTask?: string;
  shareWithTeachers?: boolean;
  teacherIds?: string[];
  pomodoroWork?: number;
  pomodoroBreak?: number;
  reflectionPrompt?: string;
  sparksBonus?: number;
  reward?: string;
  lessonTitles?: string[];
}

export const POMODORO_WORK = 25;
export const POMODORO_BREAK = 5;

export function pomodoroPlan(estimateMinutes: number): { rounds: number; work: number; breakMinutes: number } {
  const estimate = Math.max(5, Math.round(estimateMinutes || POMODORO_WORK));
  if (estimate <= POMODORO_WORK) return { rounds: 1, work: estimate, breakMinutes: 0 };
  return { rounds: Math.max(1, Math.round(estimate / POMODORO_WORK)), work: POMODORO_WORK, breakMinutes: POMODORO_BREAK };
}

/** Classic 25/5, or a custom work and break the student chose. */
export function resolvePomodoro(input: {
  mode?: 'classic' | 'custom';
  workMinutes?: number;
  breakMinutes?: number;
  estimateMinutes?: number;
}): { rounds: number; work: number; breakMinutes: number } {
  if (input.mode === 'custom' || (input.workMinutes && input.workMinutes !== POMODORO_WORK)) {
    const work = Math.max(1, Math.round(input.workMinutes || POMODORO_WORK));
    const breakMinutes = Math.max(0, Math.round(input.breakMinutes ?? POMODORO_BREAK));
    const estimate = Math.max(work, Math.round(input.estimateMinutes || work));
    return { rounds: Math.max(1, Math.round(estimate / work)), work, breakMinutes };
  }
  return pomodoroPlan(input.estimateMinutes || POMODORO_WORK);
}

/** Wall-clock focus, ignoring gaps. The timer records a segment each time it runs. */
export function focusSeconds(segments: { start: number; end: number }[]): number {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0) / 1000;
}

/**
 * Consecutive days where every goal that day was completed or excused.
 * A day with no goals does not break the run. Today counts only if it is already done.
 */
export function computeGoalStreak(goals: { dateKey: string; status: string }[], today = new Date()): number {
  const byDay = new Map<string, { status: string }[]>();
  for (const g of goals) {
    const list = byDay.get(g.dateKey);
    if (list) list.push(g);
    else byDay.set(g.dateKey, [g]);
  }
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 400; i++) {
    const key = isoDateKey(cursor);
    const day = byDay.get(key);
    const complete = !!day?.length && day.every(g => g.status === 'completed' || g.status === 'excused');
    if (complete) streak += 1;
    else if (i > 0 || !!day?.length) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function autoProgress(goal: GoalLike, events: ProgressEvent[]): { progress: number; status: GoalStatus; quizScore?: number } {
  if (goal.status === 'excused') {
    return { progress: goal.progress ?? 0, status: 'excused' };
  }
  const lessons = goal.lessonIds ?? [];
  let progress = 0;
  let quizScore: number | undefined;

  if ((goal.targetKind === 'lessons' || goal.targetKind === 'revision') && lessons.length > 0) {
    const done = lessons.filter(id => events.some(e => e.kind === 'lesson' && e.lessonId === id));
    progress = Math.round((100 * done.length) / lessons.length);
  } else if (goal.targetKind === 'quiz_score') {
    const quizzes = events.filter(e => e.kind === 'quiz' && typeof e.scorePercent === 'number' && (!goal.unitId || e.unitId === goal.unitId));
    const last = quizzes[quizzes.length - 1];
    const target = goal.quizTarget && goal.quizTarget > 0 ? goal.quizTarget : 80;
    if (last?.scorePercent != null) {
      quizScore = Math.round(last.scorePercent);
      progress = Math.min(100, Math.round((100 * quizScore) / target));
    }
  } else if (goal.targetKind === 'unit' && goal.unitId) {
    const quizzes = events.filter(e => e.kind === 'quiz' && e.unitId === goal.unitId && typeof e.scorePercent === 'number');
    const last = quizzes[quizzes.length - 1];
    if (last?.scorePercent != null) {
      quizScore = Math.round(last.scorePercent);
      progress = quizScore;
    }
    const unitLessons = events.filter(e => e.kind === 'lesson' && e.unitId === goal.unitId);
    if (lessons.length > 0) {
      const done = lessons.filter(id => events.some(e => e.kind === 'lesson' && e.lessonId === id));
      progress = Math.max(progress, Math.round((100 * done.length) / lessons.length));
    } else if (!quizzes.length && unitLessons.length > 0) {
      progress = Math.min(100, unitLessons.length * 20);
    }
  } else if (goal.checklist && goal.checklist.length > 0) {
    progress = Math.round((100 * goal.checklist.filter(item => item.done).length) / goal.checklist.length);
  }

  let status: GoalStatus = (goal.status as GoalStatus) || 'not_started';
  if (progress >= 100) status = 'completed';
  else if (progress > 0 && status === 'not_started') status = 'in_progress';
  return { progress: Math.max(0, Math.min(100, progress)), status, quizScore };
}

export function nextDateKey(dateKey: string, recurrence: GoalRecurrence | undefined): string | null {
  if (!recurrence || recurrence === 'none') return null;
  if (recurrence === 'daily') return addDays(dateKey, 1);
  if (recurrence === 'weekly') return addDays(dateKey, 7);
  let cursor = addDays(dateKey, 1);
  while (weekdayOf(cursor) === 0 || weekdayOf(cursor) === 6) cursor = addDays(cursor, 1);
  return cursor;
}

/** The following occurrence, or null when the series has ended. */
export function spawnNextGoal<T extends GoalLike>(goal: T): T | null {
  const next = nextDateKey(goal.dateKey, goal.recurrence);
  if (!next) return null;
  if (goal.endDate && next > goal.endDate) return null;
  return {
    ...goal,
    id: undefined,
    dateKey: next,
    status: 'not_started',
    progress: 0,
    actualMinutes: undefined,
    reflection: undefined,
    quizScore: undefined,
    completedLessonIds: [],
    reactions: [],
    checklist: goal.checklist?.map(item => ({ ...item, done: false })),
  };
}

export function deadlineOn(dateKey: string, hhmm: string | undefined): Date {
  const d = parseDateKey(dateKey);
  const [h, m] = (hhmm || '23:59').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function isOnTime(goal: { dateKey: string; deadline?: string }, completedAt: Date): boolean {
  return completedAt.getTime() <= deadlineOn(goal.dateKey, goal.deadline).getTime();
}

/** Sparks the server may grant. Zero unless the goal is complete and on time. */
export function sparksForGoal(
  goal: { status: string; dateKey: string; deadline?: string; sparksBonus?: number },
  completedAt: Date,
  streakDays: number,
): number {
  if (goal.status !== 'completed') return 0;
  if (!isOnTime(goal, completedAt)) return 0;
  if (goal.sparksBonus === 0) return 0;
  const base = typeof goal.sparksBonus === 'number' && goal.sparksBonus > 0 ? goal.sparksBonus : GOAL_ON_TIME_BONUS;
  return base + (streakDays >= 3 ? GOAL_STREAK_BONUS : 0);
}

export function goalWindowStart(goal: { dateKey: string; createdAtMs?: number }): number {
  if (goal.createdAtMs) return goal.createdAtMs;
  return parseDateKey(goal.dateKey).getTime();
}

/** True when work began in the last 20% of the window — the late-start signal. */
export function startedLate(goal: { dateKey: string; deadline?: string; createdAtMs?: number; startedAtMs?: number }): boolean {
  if (!goal.startedAtMs) return false;
  const start = goalWindowStart(goal);
  const end = deadlineOn(goal.dateKey, goal.deadline).getTime();
  if (end <= start) return false;
  return goal.startedAtMs >= start + (end - start) * 0.8;
}

export function checklistId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SuggestedGoal {
  title: string;
  category: GoalCategory;
  estimateMinutes: number;
  targetKind: GoalTargetKind;
  quizTarget?: number;
  freeTextTarget?: string;
  reason: string;
}

/** Goals a student can accept, drawn from weak quiz topics and upcoming exams. */
export function suggestGoalsFromSignals(input: {
  weakTopics?: { topic: string; scorePercent?: number }[];
  examDates?: { title: string; dateKey: string }[];
}): SuggestedGoal[] {
  const out: SuggestedGoal[] = [];
  for (const topic of input.weakTopics ?? []) {
    const name = topic.topic.trim();
    if (!name) continue;
    if (topic.scorePercent != null && topic.scorePercent >= 70) continue;
    out.push({
      title: `Revise ${name}`,
      category: 'revision',
      estimateMinutes: 25,
      targetKind: 'revision',
      freeTextTarget: name,
      reason: topic.scorePercent != null
        ? `Recent score ${Math.round(topic.scorePercent)}% on ${name}.`
        : `${name} needs another look.`,
    });
  }
  for (const exam of input.examDates ?? []) {
    const title = exam.title.trim();
    if (!title || !exam.dateKey) continue;
    out.push({
      title: `Prepare for ${title}`,
      category: 'study',
      estimateMinutes: 40,
      targetKind: 'free_text',
      freeTextTarget: `Exam on ${exam.dateKey}`,
      reason: `${title} is on ${exam.dateKey}.`,
    });
  }
  return out.slice(0, 6);
}

export function weakTopicsFromQuizzes(quizzes: { percentage?: number; weakestObjective?: string; unitId?: string }[]): { topic: string; scorePercent: number }[] {
  const map = new Map<string, number>();
  for (const quiz of quizzes) {
    const topic = (quiz.weakestObjective || quiz.unitId || '').trim();
    if (!topic || typeof quiz.percentage !== 'number') continue;
    const prev = map.get(topic);
    if (prev == null || quiz.percentage < prev) map.set(topic, quiz.percentage);
  }
  return [...map.entries()].map(([topic, scorePercent]) => ({ topic, scorePercent }));
}

/** A short line when the deadline has passed and the goal is still open. */
export function overdueNudge(goal: { status: string; dateKey: string; deadline?: string; title: string }, now = new Date()): string | null {
  if (goal.status === 'completed' || goal.status === 'excused') return null;
  if (now.getTime() <= deadlineOn(goal.dateKey, goal.deadline).getTime()) return null;
  return `"${goal.title}" is past its time. A short session still counts.`;
}

export function formatProgressDigest(input: {
  childName: string;
  minutes: number;
  lessons: number;
  quizScores: number[];
  goalsMet: number;
  goalsSet: number;
}): string {
  const scores = input.quizScores.filter(score => Number.isFinite(score));
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const quiz = average == null ? 'no quizzes' : `quiz average ${average}%`;
  const lessonWord = input.lessons === 1 ? 'lesson' : 'lessons';
  return `${input.childName}: ${Math.round(input.minutes)} min studied, ${input.lessons} ${lessonWord} done, ${quiz}, ${input.goalsMet} of ${input.goalsSet} goals met.`;
}

export function focusMinutesTotal(goals: { focusMinutes?: number; actualMinutes?: number }[]): number {
  return goals.reduce((sum, goal) => sum + (goal.focusMinutes ?? goal.actualMinutes ?? 0), 0);
}
