/**
 * Shared DailyGoal contract for the web app and the Poketschool app.
 * The collection is `daily_goals`. Canonical field names are what both
 * clients write. The reader also accepts a few aliases so an older app
 * document still opens.
 */

export const GOAL_CATEGORIES = ['study', 'revision', 'practice', 'reading', 'other'] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ['not_started', 'in_progress', 'completed', 'overdue', 'excused'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface DailyGoalCore {
  id: string;
  studentId: string;
  dateKey: string;
  title: string;
  category: GoalCategory;
  estimateMinutes: number;
  deadline: string;
  status: GoalStatus;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DEADLINE = /^\d{2}:\d{2}$/;

function asCategory(value: unknown): GoalCategory {
  return GOAL_CATEGORIES.includes(value as GoalCategory) ? (value as GoalCategory) : 'other';
}

function asStatus(value: unknown, completed: unknown): GoalStatus {
  if (GOAL_STATUSES.includes(value as GoalStatus)) return value as GoalStatus;
  if (completed === true) return 'completed';
  return 'not_started';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build the fields every screen reads. Returns null when the document has
 * no student and no date, which is not a goal either client can show.
 */
export function coerceDailyGoal(id: string, raw: Record<string, unknown>): DailyGoalCore | null {
  const studentId = text(raw.studentId) || text(raw.userId);
  const dateKey = DATE_KEY.test(text(raw.dateKey))
    ? text(raw.dateKey)
    : (DATE_KEY.test(text(raw.date)) ? text(raw.date) : '');
  if (!studentId || !dateKey) return null;

  const deadline = DEADLINE.test(text(raw.deadline))
    ? text(raw.deadline)
    : (DEADLINE.test(text(raw.due)) ? text(raw.due) : '23:59');
  const minutes = raw.estimateMinutes ?? raw.minutes;
  const estimateMinutes = typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes)
    : 30;

  return {
    id,
    studentId,
    dateKey,
    title: text(raw.title) || 'Goal',
    category: asCategory(raw.category),
    estimateMinutes,
    deadline,
    status: asStatus(raw.status, raw.completed),
  };
}
