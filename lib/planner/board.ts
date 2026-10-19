export const PLANNER_KINDS = ['class', 'assignment', 'exam', 'attendance', 'goal', 'personal'] as const;
export type PlannerKind = (typeof PLANNER_KINDS)[number];

export const KIND_COLOR: Record<PlannerKind, string> = {
  class: '#1E6A83',
  assignment: '#203337',
  exam: '#0E4C63',
  attendance: '#3FE0D0',
  goal: '#14566B',
  personal: '#3A7F96',
};

export interface BoardEvent {
  id: string;
  title: string;
  kind: PlannerKind;
  dueAt: number;
  className: string;
  notes: string;
  reminder: string;
  status: 'open' | 'done' | 'cancelled';
  ownerId: string;
  studentIds: string[];
  source: 'planner' | 'assessment' | 'attendance' | 'goal' | 'class';
  sourceId: string;
}

export function asKind(value: unknown): PlannerKind {
  return PLANNER_KINDS.includes(value as PlannerKind) ? value as PlannerKind : 'personal';
}
