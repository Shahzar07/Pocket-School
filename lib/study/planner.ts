/**
 * Deterministic study planner. It does not call ET AI.
 * The same courses, deadlines, and free time always produce the same week.
 * Assigned goals are stored with the daily goal contract and cannot be deleted.
 */

import { anyTargetMatch, type TargetViewer } from '../allocation-targets';
import { addDays, isoDateKey, parseDateKey, weekdayOf } from '../insights/dates';
import type { GoalCategory } from '../goals';
import { buildConcerns, type ConcernFlag } from '../insights/concerns';

export const MAX_GOALS_PER_DAY = 5;
export const GOAL_SOURCES = ['self', 'et_ai', 'teacher', 'parent'] as const;
export type PlanSource = (typeof GOAL_SOURCES)[number];

export type PlanLinkType = 'course' | 'lesson' | 'assignment' | 'exam' | 'note';

export interface PlanLink {
  type: PlanLinkType;
  id: string;
}

export interface DayWindow {
  /** 0 Sunday … 6 Saturday */
  weekday: number;
  start: string;
  end: string;
}

export interface StudyAvailability {
  windows: DayWindow[];
}

export interface PlannerLimits {
  maxDailyMinutes: number;
  maxGoalsPerDay: number;
  rescheduleLimit: number;
  /** Misses in a row before a teacher or institution flag. */
  missFlagAfter: number;
}

export interface PlannerItem {
  id: string;
  title: string;
  kind: PlanLinkType | 'weak_topic';
  courseId?: string;
  courseLabel?: string;
  lessonId?: string;
  dueDateKey: string;
  dueTime?: string;
  minutes: number;
  /** Higher numbers are placed first. */
  weight?: number;
}

export interface PlannedGoal {
  key: string;
  title: string;
  dateKey: string;
  deadline: string;
  estimateMinutes: number;
  category: GoalCategory;
  source: PlanSource;
  link: PlanLink;
  courseId?: string;
  courseLabel?: string;
  lessonId?: string;
  priority: 'low' | 'medium' | 'high';
  priorityStar: boolean;
  parentVisibility: boolean;
  private: boolean;
  catchUp: boolean;
  dueDateKey: string;
  rescheduleLimit: number;
  order: number;
}

export interface StoredGoal {
  id: string;
  title: string;
  dateKey: string;
  deadline: string;
  estimateMinutes: number;
  status: string;
  source?: string;
  private?: boolean;
  parentVisibility?: boolean;
  studentId?: string;
  studentName?: string;
  actualMinutes?: number;
  rescheduleCount?: number;
  rescheduleLimit?: number;
  dueDateKey?: string;
  link?: PlanLink;
  catchUp?: boolean;
  missCount?: number;
  category?: GoalCategory;
}

export interface RescheduleEntry {
  at: string;
  goalId: string;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  by: 'student';
}

const CHUNK = 45;

export function defaultAvailability(): StudyAvailability {
  const evenings: DayWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    start: '16:00',
    end: '19:30',
  }));
  const weekends: DayWindow[] = [0, 6].map((weekday) => ({
    weekday,
    start: '10:00',
    end: '13:00',
  }));
  return { windows: [...evenings, ...weekends] };
}

export function limitsForAge(tier: 'under13' | 'teen' | 'adult' | 'unknown'): PlannerLimits {
  if (tier === 'under13') {
    return { maxDailyMinutes: 45, maxGoalsPerDay: 3, rescheduleLimit: 1, missFlagAfter: 2 };
  }
  if (tier === 'teen') {
    return { maxDailyMinutes: 90, maxGoalsPerDay: MAX_GOALS_PER_DAY, rescheduleLimit: 2, missFlagAfter: 3 };
  }
  return { maxDailyMinutes: 150, maxGoalsPerDay: MAX_GOALS_PER_DAY, rescheduleLimit: 2, missFlagAfter: 3 };
}

/** Admin defaults can only tighten the age cap. They cannot raise it. */
export function mergeLimits(age: PlannerLimits, admin?: Partial<PlannerLimits> | null): PlannerLimits {
  const daily = positive(admin?.maxDailyMinutes, age.maxDailyMinutes);
  const goals = positive(admin?.maxGoalsPerDay, age.maxGoalsPerDay);
  const moves = positive(admin?.rescheduleLimit, age.rescheduleLimit);
  const misses = positive(admin?.missFlagAfter, age.missFlagAfter);
  return {
    maxDailyMinutes: Math.min(age.maxDailyMinutes, daily),
    maxGoalsPerDay: Math.min(age.maxGoalsPerDay, goals, MAX_GOALS_PER_DAY),
    rescheduleLimit: Math.min(age.rescheduleLimit, moves),
    missFlagAfter: Math.max(1, Math.min(age.missFlagAfter, misses)),
  };
}

export function isAssignedSource(source: string | null | undefined): boolean {
  return source === 'et_ai' || source === 'ai' || source === 'teacher' || source === 'parent';
}

export function canDeleteGoal(source: string | null | undefined): boolean {
  return !isAssignedSource(source);
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function formatClock(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function windowMinutes(window: DayWindow): number {
  return Math.max(0, clockMinutes(window.end) - clockMinutes(window.start));
}

export function minutesLeftToday(now: Date, availability: StudyAvailability): number {
  const weekday = now.getDay();
  const current = now.getHours() * 60 + now.getMinutes();
  return availability.windows
    .filter((window) => window.weekday === weekday)
    .reduce((sum, window) => {
      const end = clockMinutes(window.end);
      const start = Math.max(clockMinutes(window.start), current);
      return sum + Math.max(0, end - start);
    }, 0);
}

function categoryFor(kind: PlannerItem['kind']): GoalCategory {
  if (kind === 'assignment') return 'homework';
  if (kind === 'exam') return 'practice';
  if (kind === 'weak_topic') return 'revision';
  if (kind === 'note') return 'personal';
  if (kind === 'lesson' || kind === 'course') return 'study';
  return 'study';
}

function linkFor(item: PlannerItem): PlanLink {
  if (item.kind === 'weak_topic') {
    return { type: item.lessonId ? 'lesson' : 'course', id: item.lessonId || item.courseId || item.id };
  }
  if (item.kind === 'lesson') return { type: 'lesson', id: item.lessonId || item.id };
  if (item.kind === 'note') return { type: 'note', id: item.id };
  if (item.kind === 'exam') return { type: 'exam', id: item.id };
  if (item.kind === 'assignment') return { type: 'assignment', id: item.id };
  return { type: 'course', id: item.courseId || item.id };
}

interface DayCapacity {
  dateKey: string;
  minutes: number;
  goals: number;
  end: string;
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end && out.length < 21) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

function capacityFor(
  dateKey: string,
  availability: StudyAvailability,
  limits: PlannerLimits,
  used: Map<string, { minutes: number; goals: number }>,
): DayCapacity {
  const windows = availability.windows.filter((window) => window.weekday === weekdayOf(dateKey));
  const open = windows.reduce((sum, window) => sum + windowMinutes(window), 0);
  const spent = used.get(dateKey) ?? { minutes: 0, goals: 0 };
  const end = windows.length ? windows[windows.length - 1].end : '19:00';
  return {
    dateKey,
    minutes: Math.max(0, Math.min(limits.maxDailyMinutes, open) - spent.minutes),
    goals: Math.max(0, limits.maxGoalsPerDay - spent.goals),
    end,
  };
}

function take(used: Map<string, { minutes: number; goals: number }>, dateKey: string, minutes: number) {
  const current = used.get(dateKey) ?? { minutes: 0, goals: 0 };
  used.set(dateKey, { minutes: current.minutes + minutes, goals: current.goals + 1 });
}

/**
 * Work backwards from each deadline into the free windows.
 * A block that does not fit before the deadline becomes a catch-up goal.
 */
export function buildStudyPlan(input: {
  today: string;
  availability?: StudyAvailability;
  limits: PlannerLimits;
  items: PlannerItem[];
  existingMinutes?: Record<string, number>;
}): { goals: PlannedGoal[]; unplaced: PlannerItem[] } {
  const availability = input.availability ?? defaultAvailability();
  const used = new Map<string, { minutes: number; goals: number }>();
  for (const [dateKey, minutes] of Object.entries(input.existingMinutes ?? {})) {
    if (minutes > 0) used.set(dateKey, { minutes, goals: 0 });
  }
  const items = [...input.items].sort((a, b) => {
    if (a.dueDateKey !== b.dueDateKey) return a.dueDateKey < b.dueDateKey ? -1 : 1;
    return (b.weight ?? 0) - (a.weight ?? 0);
  });
  const goals: PlannedGoal[] = [];
  const unplaced: PlannerItem[] = [];
  let order = 0;

  for (const item of items) {
    let left = Math.max(15, Math.round(item.minutes));
    const horizonEnd = addDays(input.today, 14);
    const due = item.dueDateKey < input.today ? input.today : item.dueDateKey;
    const before = daysBetween(input.today, due > horizonEnd ? horizonEnd : due).reverse();
    let placed = false;
    while (left > 0) {
      const slot = before.find((dateKey) => {
        const room = capacityFor(dateKey, availability, input.limits, used);
        return room.minutes >= 15 && room.goals > 0;
      });
      const catchUpDay = slot ? null : daysBetween(addDays(due, 1), addDays(due, 7)).find((dateKey) => {
        const room = capacityFor(dateKey, availability, input.limits, used);
        return room.minutes >= 15 && room.goals > 0;
      });
      const dateKey = slot ?? catchUpDay;
      if (!dateKey) break;
      const room = capacityFor(dateKey, availability, input.limits, used);
      const minutes = Math.min(left, CHUNK, room.minutes);
      if (minutes < 15) break;
      const sameDay = dateKey === item.dueDateKey && item.dueTime;
      const deadline = sameDay ? item.dueTime! : room.end;
      const high = item.kind === 'exam' || item.kind === 'weak_topic' || (item.weight ?? 0) >= 8;
      goals.push({
        key: `${item.id}-${dateKey}-${order}`,
        title: left === Math.max(15, Math.round(item.minutes)) ? item.title : `${item.title} (part)`,
        dateKey,
        deadline,
        estimateMinutes: minutes,
        category: categoryFor(item.kind),
        source: 'et_ai',
        link: linkFor(item),
        courseId: item.courseId,
        courseLabel: item.courseLabel,
        lessonId: item.lessonId,
        priority: high ? 'high' : 'medium',
        priorityStar: high,
        parentVisibility: true,
        private: false,
        catchUp: !slot,
        dueDateKey: item.dueDateKey,
        rescheduleLimit: input.limits.rescheduleLimit,
        order,
      });
      order += 1;
      take(used, dateKey, minutes);
      left -= minutes;
      placed = true;
    }
    if (!placed || left >= 15) unplaced.push({ ...item, minutes: left });
  }

  return { goals, unplaced };
}

export function requestReschedule(
  goal: StoredGoal,
  next: { dateKey: string; deadline: string },
  at: string,
): { ok: true; goal: StoredGoal; entry: RescheduleEntry } | { ok: false; reason: string } {
  if (!isAssignedSource(goal.source)) {
    return {
      ok: true,
      goal: { ...goal, dateKey: next.dateKey, deadline: next.deadline },
      entry: {
        at,
        goalId: goal.id,
        fromDate: goal.dateKey,
        toDate: next.dateKey,
        fromTime: goal.deadline,
        toTime: next.deadline,
        by: 'student',
      },
    };
  }
  const count = goal.rescheduleCount ?? 0;
  const limit = goal.rescheduleLimit ?? 2;
  if (count >= limit) return { ok: false, reason: 'This assigned goal has no reschedules left.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.dateKey) || !/^\d{2}:\d{2}$/.test(next.deadline)) {
    return { ok: false, reason: 'Choose a day and a time.' };
  }
  const latest = goal.dueDateKey ? addDays(goal.dueDateKey, 2) : addDays(goal.dateKey, 7);
  if (next.dateKey > latest) return { ok: false, reason: 'That day is past the allowed window.' };
  const entry: RescheduleEntry = {
    at,
    goalId: goal.id,
    fromDate: goal.dateKey,
    toDate: next.dateKey,
    fromTime: goal.deadline,
    toTime: next.deadline,
    by: 'student',
  };
  return {
    ok: true,
    goal: {
      ...goal,
      dateKey: next.dateKey,
      deadline: next.deadline,
      rescheduleCount: count + 1,
    },
    entry,
  };
}

export function markOverdue(goals: StoredGoal[], now: Date): StoredGoal[] {
  return goals.map((goal) => {
    if (goal.status === 'completed' || goal.status === 'excused' || goal.status === 'overdue') return goal;
    const due = parseDateKey(goal.dateKey);
    const [h, m] = (goal.deadline || '23:59').split(':').map(Number);
    due.setHours(h || 23, m || 59, 0, 0);
    if (now.getTime() <= due.getTime()) return goal;
    return { ...goal, status: 'overdue', missCount: (goal.missCount ?? 0) + (goal.status === 'overdue' ? 0 : 1) };
  });
}

/** Move an overdue assigned goal into the next open slot. The original stays overdue. */
export function catchUpFor(
  overdue: StoredGoal[],
  today: string,
  availability: StudyAvailability,
  limits: PlannerLimits,
  usedMinutes: Record<string, number> = {},
): PlannedGoal[] {
  const items: PlannerItem[] = overdue
    .filter((goal) => goal.status === 'overdue' && !goal.catchUp && isAssignedSource(goal.source))
    .map((goal) => ({
      id: `catch-${goal.id}`,
      title: `Catch up: ${goal.title}`,
      kind: goal.link?.type ?? 'lesson',
      courseId: goal.link?.type === 'course' ? goal.link.id : undefined,
      lessonId: goal.link?.type === 'lesson' ? goal.link.id : undefined,
      dueDateKey: today,
      minutes: goal.estimateMinutes,
      weight: 9,
    }));
  return buildStudyPlan({
    today,
    availability,
    limits,
    items,
    existingMinutes: usedMinutes,
  }).goals.map((goal) => ({ ...goal, catchUp: true, source: 'et_ai' as const }));
}

export interface Escalation {
  studentReminder: boolean;
  parentNotify: boolean;
  teacherFlag: boolean;
  concern: ConcernFlag | null;
}

export function escalationFor(missCount: number, limits: PlannerLimits): Escalation {
  const missed = Math.max(0, missCount);
  const concern = missed >= limits.missFlagAfter
    ? buildConcerns({ missedGoals: missed }).find((flag) => flag.kind === 'missed_goals') ?? null
    : null;
  return {
    studentReminder: missed >= 1,
    parentNotify: missed >= 1,
    teacherFlag: missed >= limits.missFlagAfter,
    concern,
  };
}

/**
 * Ahead: pull the next unfinished assigned block into today when there is room.
 * Behind: move an unfinished personal goal off today so catch-up fits.
 */
export function rebalance(goals: PlannedGoal[], today: string, limits: PlannerLimits): PlannedGoal[] {
  const next = goals.map((goal) => ({ ...goal }));
  const todayMinutes = next
    .filter((goal) => goal.dateKey === today)
    .reduce((sum, goal) => sum + goal.estimateMinutes, 0);
  const todayCount = next.filter((goal) => goal.dateKey === today).length;
  if (todayMinutes + 20 <= limits.maxDailyMinutes && todayCount < limits.maxGoalsPerDay) {
    const future = next
      .filter((goal) => goal.dateKey > today && goal.source === 'et_ai' && goal.link.type !== 'exam' && !goal.catchUp)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.order - b.order)[0];
    if (future && todayMinutes + future.estimateMinutes <= limits.maxDailyMinutes) {
      future.dateKey = today;
    }
  }
  const overdueLoad = next.filter((goal) => goal.catchUp && goal.dateKey === today).reduce((sum, goal) => sum + goal.estimateMinutes, 0);
  if (overdueLoad > 0 && todayMinutes > limits.maxDailyMinutes) {
    const personal = next.find((goal) => goal.dateKey === today && goal.source === 'self');
    if (personal) personal.dateKey = addDays(today, 1);
  }
  return next;
}

export interface WeekColumn {
  dateKey: string;
  label: string;
  goals: { title: string; minutes: number; source: string; status?: string; private?: boolean }[];
  plannedMinutes: number;
  doneMinutes: number;
}

export function weekColumns(
  goals: { title: string; dateKey: string; estimateMinutes: number; actualMinutes?: number; status?: string; source?: string; private?: boolean }[],
  weekStart: string,
): WeekColumn[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(weekStart, index);
    const day = goals.filter((goal) => goal.dateKey === dateKey && !goal.private);
    const label = parseDateKey(dateKey).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    return {
      dateKey,
      label,
      goals: day.map((goal) => ({
        title: goal.title,
        minutes: goal.estimateMinutes,
        source: goal.source || 'self',
        status: goal.status,
        private: false,
      })),
      plannedMinutes: day.reduce((sum, goal) => sum + goal.estimateMinutes, 0),
      doneMinutes: day.reduce((sum, goal) => sum + (goal.status === 'completed' ? (goal.actualMinutes || goal.estimateMinutes) : 0), 0),
    };
  });
}

export function planVsDone(goals: { estimateMinutes: number; actualMinutes?: number; status?: string; private?: boolean; parentVisibility?: boolean }[]): {
  planned: number;
  actual: number;
  onTime: number;
  open: number;
  missed: number;
  rate: number;
} {
  const visible = goals.filter((goal) => goal.private !== true && goal.parentVisibility !== false);
  const planned = visible.reduce((sum, goal) => sum + goal.estimateMinutes, 0);
  const actual = visible.reduce((sum, goal) => sum + (goal.actualMinutes || 0), 0);
  const onTime = visible.filter((goal) => goal.status === 'completed').length;
  const missed = visible.filter((goal) => goal.status === 'overdue').length;
  const open = visible.filter((goal) => goal.status !== 'completed' && goal.status !== 'excused').length;
  const rate = visible.length ? Math.round((onTime / visible.length) * 100) : 0;
  return { planned, actual, onTime, open, missed, rate };
}

export interface AdherenceRow {
  studentId: string;
  name: string;
  assigned: number;
  onTime: number;
  rate: number;
}

/** Counts only. Private goals are left out, and titles are not returned. */
export function classAdherence(rows: { studentId: string; name: string; goals: StoredGoal[] }[]): {
  classRate: number;
  rows: AdherenceRow[];
} {
  const shaped = rows.map((row) => {
    const assigned = row.goals.filter((goal) => isAssignedSource(goal.source) && goal.private !== true && goal.parentVisibility !== false);
    const onTime = assigned.filter((goal) => goal.status === 'completed').length;
    return {
      studentId: row.studentId,
      name: row.name,
      assigned: assigned.length,
      onTime,
      rate: assigned.length ? Math.round((onTime / assigned.length) * 100) : 0,
    };
  });
  const assigned = shaped.reduce((sum, row) => sum + row.assigned, 0);
  const onTime = shaped.reduce((sum, row) => sum + row.onTime, 0);
  return { classRate: assigned ? Math.round((onTime / assigned) * 100) : 0, rows: shaped };
}

export function viewersForAssignment(targets: readonly string[], roster: readonly TargetViewer[]): TargetViewer[] {
  return roster.filter((viewer) => anyTargetMatch(targets, viewer).hit);
}

export function shouldAutoTick(goal: { link?: PlanLink; lessonId?: string; status: string }, event: { kind: 'lesson' | 'assignment'; id: string }): boolean {
  if (goal.status === 'completed' || goal.status === 'excused') return false;
  if (event.kind === 'lesson') {
    return goal.link?.type === 'lesson' && (goal.link.id === event.id || goal.lessonId === event.id);
  }
  return goal.link?.type === 'assignment' && goal.link.id === event.id;
}

export function sourceLabel(source: string | undefined): string {
  if (source === 'et_ai' || source === 'ai') return 'Assigned by ET AI';
  if (source === 'teacher') return 'Assigned by a teacher';
  if (source === 'parent') return 'Assigned by a parent';
  return 'Your goal';
}

export function weekStartKey(today = isoDateKey()): string {
  return addDays(today, -weekdayOf(today));
}
