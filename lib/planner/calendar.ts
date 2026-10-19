/** Month, week, and day grids for the admin planner. Times are local calendar dates. */

export type PlannerView = 'month' | 'week' | 'day';
export type PlannerStatus = 'open' | 'done' | 'cancelled';
export type PlannerSource = 'planner' | 'goal' | 'assignment';

export interface PlannerItem {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  institutionId: string;
  className: string;
  dueAt: number;
  status: PlannerStatus;
  notes: string;
  attachmentName: string;
  reminder: string;
  source: PlannerSource;
  sourceId: string;
}

export function startOfDay(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addDays(value: number, days: number): number {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function monthCells(anchor: number): number[] {
  const date = new Date(anchor);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first.getTime(), -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function weekCells(anchor: number): number[] {
  const date = new Date(anchor);
  const start = addDays(startOfDay(anchor), -date.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function itemsOn(items: PlannerItem[], day: number): PlannerItem[] {
  return items.filter((item) => sameDay(item.dueAt, day)).sort((a, b) => a.dueAt - b.dueAt);
}

/** Dragging a card moves the due date and keeps the clock time. */
export function moveDue(dueAt: number, day: number): number {
  const previous = new Date(dueAt);
  const next = new Date(startOfDay(day));
  next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
  return next.getTime();
}

export function reschedule(item: PlannerItem, day: number): PlannerItem {
  return { ...item, dueAt: moveDue(item.dueAt, day) };
}

export function fromGoal(input: { id: string; title: string; studentId: string; dueAt: number; className?: string }): PlannerItem {
  return {
    id: `goal-${input.id}`,
    title: input.title,
    ownerId: input.studentId,
    ownerName: input.studentId,
    institutionId: '',
    className: input.className || '',
    dueAt: input.dueAt,
    status: 'open',
    notes: '',
    attachmentName: '',
    reminder: '',
    source: 'goal',
    sourceId: input.id,
  };
}

export function fromAssignment(input: { id: string; title: string; ownerId: string; dueAt: number; className: string; institutionId?: string }): PlannerItem {
  return {
    id: `assignment-${input.id}`,
    title: input.title,
    ownerId: input.ownerId,
    ownerName: input.ownerId,
    institutionId: input.institutionId || '',
    className: input.className,
    dueAt: input.dueAt,
    status: 'open',
    notes: '',
    attachmentName: '',
    reminder: '',
    source: 'assignment',
    sourceId: input.id,
  };
}
