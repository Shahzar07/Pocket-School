import { coerceDailyGoal, type DailyGoalCore } from '@/lib/goals';

/** Local calendar day, `YYYY-MM-DD`. Pass a date in tests. */
export function localDateKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * A reading session as a shared daily goal. Category is always `reading`.
 * The focus timer supplies active seconds. Fifteen minutes is the default estimate.
 */
export function readingGoal(input: {
  id?: string;
  studentId: string;
  dateKey: string;
  title?: string;
  estimateMinutes?: number;
  activeSeconds: number;
}): DailyGoalCore | null {
  const estimate = input.estimateMinutes && input.estimateMinutes > 0 ? Math.round(input.estimateMinutes) : 15;
  const minutes = Math.floor(Math.max(0, input.activeSeconds) / 60);
  const status = minutes >= estimate ? 'completed' : minutes > 0 ? 'in_progress' : 'not_started';
  return coerceDailyGoal(input.id ?? `${input.studentId}:${input.dateKey}:reading`, {
    studentId: input.studentId,
    dateKey: input.dateKey,
    title: input.title ?? 'Reading',
    category: 'reading',
    estimateMinutes: estimate,
    deadline: '23:59',
    status,
  });
}
