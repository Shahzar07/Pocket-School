import type { Assessment, AssignedGoal, AttendanceRow, DeskState, SchoolClass } from './model';

export interface PlannerDoc {
  title: string;
  kind: 'class' | 'assignment' | 'exam' | 'attendance' | 'goal';
  dueAt: number;
  className: string;
  notes: string;
  reminder: string;
  status: 'open';
  ownerId: string;
  studentIds: string[];
  source: 'assessment' | 'attendance' | 'goal' | 'class';
  sourceId: string;
}

export interface PlannerOp {
  id: string;
  op: 'set' | 'delete';
  data?: PlannerDoc;
}

function clip(value: string, fallback: string): string {
  const text = value.trim() || fallback;
  return text.slice(0, 180);
}

function changedIds<T extends { id: string }>(prev: T[], next: T[]): { upsert: T[]; remove: string[] } {
  const before = new Map(prev.map((item) => [item.id, JSON.stringify(item)]));
  const after = new Set(next.map((item) => item.id));
  return {
    upsert: next.filter((item) => before.get(item.id) !== JSON.stringify(item)),
    remove: prev.filter((item) => !after.has(item.id)).map((item) => item.id),
  };
}

export function weekdayDue(timetable: string, from = Date.now()): number {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const lower = timetable.toLowerCase();
  let index = names.findIndex((name) => lower.includes(name.slice(0, 3)));
  const now = new Date(from);
  if (index < 0) index = now.getDay();
  const when = new Date(now);
  const delta = (index - now.getDay() + 7) % 7;
  when.setDate(now.getDate() + delta);
  const clock = /(\d{1,2}):(\d{2})/.exec(timetable);
  const hour = clock ? Math.min(23, Number(clock[1])) : 9;
  const minute = clock ? Math.min(59, Number(clock[2])) : 0;
  when.setHours(hour, minute, 0, 0);
  return when.getTime();
}

function className(state: DeskState, classId: string): string {
  return state.classes.find((item) => item.id === classId)?.name || 'Class';
}

function readers(state: DeskState, classId: string, extra: string[]): string[] {
  const klass = state.classes.find((item) => item.id === classId);
  const enrolled = state.enrolments
    .filter((row) => row.classId === classId && row.status === 'active')
    .map((row) => row.studentId);
  return [...new Set([klass?.ownerTeacherId || '', ...extra, ...enrolled].filter(Boolean))].slice(0, 30);
}

function classDoc(state: DeskState, klass: SchoolClass, actorId: string): PlannerDoc {
  return {
    title: clip(klass.name, 'Class'),
    kind: 'class',
    dueAt: weekdayDue(klass.timetable),
    className: klass.name,
    notes: [klass.subject, klass.room, klass.timetable].filter(Boolean).join(' · '),
    reminder: '',
    status: 'open',
    ownerId: actorId,
    studentIds: readers(state, klass.id, []),
    source: 'class',
    sourceId: klass.id,
  };
}

function assessmentDoc(state: DeskState, item: Assessment, actorId: string): PlannerDoc {
  const parsed = Date.parse(item.dueAt);
  const listed = item.studentIds.length > 0 ? item.studentIds : [];
  return {
    title: clip(item.title, 'Assignment'),
    kind: item.kind === 'exam' || item.kind === 'test' ? 'exam' : 'assignment',
    dueAt: Number.isFinite(parsed) ? parsed : Date.now(),
    className: className(state, item.classId),
    notes: item.instructions.slice(0, 500),
    reminder: '',
    status: 'open',
    ownerId: actorId,
    studentIds: readers(state, item.classId, listed),
    source: 'assessment',
    sourceId: item.id,
  };
}

function goalDue(goal: AssignedGoal): number {
  const day = (goal.dueDateKey || goal.due || '').slice(0, 10);
  const clock = /^\d{2}:\d{2}$/.test(goal.dueTime) ? goal.dueTime : '09:00';
  const parsed = Date.parse(`${day}T${clock}:00`);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function goalDoc(state: DeskState, goal: AssignedGoal, actorId: string): PlannerDoc {
  return {
    title: clip(goal.title, 'Goal'),
    kind: 'goal',
    dueAt: goalDue(goal),
    className: goal.classId ? className(state, goal.classId) : '',
    notes: goal.topic,
    reminder: '',
    status: 'open',
    ownerId: actorId,
    studentIds: [...new Set([goal.studentId, actorId].filter(Boolean))].slice(0, 30),
    source: 'goal',
    sourceId: goal.id,
  };
}

function attendanceDoc(state: DeskState, row: AttendanceRow, actorId: string): PlannerDoc {
  const parsed = Date.parse(`${row.date.slice(0, 10)}T09:00:00`);
  return {
    title: clip(`${className(state, row.classId)} attendance`, 'Attendance'),
    kind: 'attendance',
    dueAt: Number.isFinite(parsed) ? parsed : Date.now(),
    className: className(state, row.classId),
    notes: [row.session, row.status, row.reason].filter(Boolean).join(' · '),
    reminder: '',
    status: 'open',
    ownerId: actorId,
    studentIds: [...new Set([row.studentId, actorId].filter(Boolean))].slice(0, 30),
    source: 'attendance',
    sourceId: row.id,
  };
}

/** Desk rows that should appear on the study planner, including removals. */
export function plannerOps(prev: DeskState, next: DeskState, actorId: string): PlannerOp[] {
  if (!actorId) return [];
  const ops: PlannerOp[] = [];
  const classes = changedIds(prev.classes, next.classes);
  const enrolments = changedIds(prev.enrolments, next.enrolments);
  const assessments = changedIds(prev.assessments, next.assessments);
  const goals = changedIds(prev.goals, next.goals);
  const attendance = changedIds(prev.attendance, next.attendance);

  const classTouch = new Set<string>([
    ...classes.upsert.map((item) => item.id),
    ...enrolments.upsert.map((item) => item.classId),
    ...enrolments.remove.flatMap((id) => {
      const row = [...prev.enrolments, ...next.enrolments].find((item) => item.id === id);
      return row ? [row.classId] : [];
    }),
  ]);

  for (const id of classes.remove) ops.push({ id: `desk-class-${id}`, op: 'delete' });
  for (const id of classTouch) {
    if (classes.remove.includes(id)) continue;
    const klass = next.classes.find((item) => item.id === id);
    if (!klass || klass.status === 'archived') {
      ops.push({ id: `desk-class-${id}`, op: 'delete' });
      continue;
    }
    ops.push({ id: `desk-class-${id}`, op: 'set', data: classDoc(next, klass, actorId) });
  }

  for (const id of assessments.remove) ops.push({ id: `desk-assessment-${id}`, op: 'delete' });
  const assessmentTouch = new Set(assessments.upsert.map((item) => item.id));
  for (const classId of classTouch) {
    for (const item of next.assessments) {
      if (item.classId === classId) assessmentTouch.add(item.id);
    }
  }
  for (const id of assessmentTouch) {
    const item = next.assessments.find((row) => row.id === id);
    if (!item || item.status !== 'published') {
      ops.push({ id: `desk-assessment-${id}`, op: 'delete' });
      continue;
    }
    ops.push({ id: `desk-assessment-${id}`, op: 'set', data: assessmentDoc(next, item, actorId) });
  }

  for (const id of goals.remove) ops.push({ id: `desk-goal-${id}`, op: 'delete' });
  for (const item of goals.upsert) {
    if (item.private) {
      ops.push({ id: `desk-goal-${item.id}`, op: 'delete' });
      continue;
    }
    ops.push({ id: `desk-goal-${item.id}`, op: 'set', data: goalDoc(next, item, actorId) });
  }

  for (const id of attendance.remove) ops.push({ id: `desk-attendance-${id}`, op: 'delete' });
  for (const item of attendance.upsert) {
    ops.push({ id: `desk-attendance-${item.id}`, op: 'set', data: attendanceDoc(next, item, actorId) });
  }
  const unique = new Map<string, PlannerOp>();
  for (const op of ops) unique.set(op.id, op);
  return [...unique.values()];
}
