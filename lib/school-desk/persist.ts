'use client';

import {
  collection, doc, onSnapshot, query, where, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  emptyDesk, canDeleteGoal, canEditGoal,
  type Assessment, type AssignedGoal, type DeskRole, type DeskState, type Enrolment, type GradeBand, type Mark, type ReportCard, type ScaleId, type SchoolClass, type SchoolInstitution,
} from '@/lib/school-desk/model';

export interface DeskActor {
  uid: string;
  name: string;
  role: DeskRole;
  institutionId: string;
  institutionName: string;
}

const SCALES: ScaleId[] = ['igcse_9_1', 'astar_g', 'percent', 'points', 'pass_fail', 'custom'];

function asScale(value: unknown): ScaleId {
  return SCALES.includes(value as ScaleId) ? value as ScaleId : 'igcse_9_1';
}

function bands(value: unknown): GradeBand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const band = row as { min?: unknown; grade?: unknown };
    return typeof band.grade === 'string' && typeof band.min === 'number' ? [{ min: band.min, grade: band.grade }] : [];
  });
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seqFrom(ids: string[]): number {
  let max = 1;
  for (const id of ids) {
    const match = /-(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function classFrom(id: string, data: DocumentData): SchoolClass | null {
  if (typeof data.name !== 'string' || typeof data.ownerTeacherId !== 'string') return null;
  return {
    id,
    institutionId: text(data.institutionId),
    name: data.name,
    subject: text(data.subject),
    level: data.level === 'Primary' || data.level === 'Lower Secondary' || data.level === 'IGCSE' || data.level === 'A-Level' ? data.level : 'IGCSE',
    programme: text(data.programme),
    term: text(data.term),
    campus: text(data.campus),
    room: text(data.room),
    timetable: text(data.timetable),
    coTeachers: Array.isArray(data.coTeachers) ? data.coTeachers.filter((item): item is string => typeof item === 'string') : [],
    capacity: num(data.capacity, 20),
    status: data.status === 'archived' ? 'archived' : 'active',
    joinCode: text(data.joinCode),
    ownerTeacherId: data.ownerTeacherId,
    ownerTeacherName: text(data.ownerTeacherName),
    createdByRole: data.createdByRole === 'institution_admin' ? 'institution_admin' : 'teacher',
    announcements: Array.isArray(data.announcements) ? data.announcements.filter((item): item is string => typeof item === 'string') : [],
  };
}

function enrolmentFrom(id: string, data: DocumentData): Enrolment | null {
  if (typeof data.classId !== 'string' || typeof data.studentId !== 'string') return null;
  return {
    id,
    classId: data.classId,
    studentId: data.studentId,
    studentName: text(data.studentName, 'Student'),
    status: data.status === 'active' ? 'active' : 'pending',
    joinMethod: data.joinMethod === 'roster' || data.joinMethod === 'csv' || data.joinMethod === 'invite' || data.joinMethod === 'qr' || data.joinMethod === 'code' ? data.joinMethod : 'invite',
    under18: data.under18 === true,
    institutionMember: data.institutionMember !== false,
    holdReason: text(data.holdReason),
  };
}

function assessmentFrom(id: string, data: DocumentData): Assessment | null {
  if (typeof data.classId !== 'string' || typeof data.title !== 'string') return null;
  return {
    id,
    classId: data.classId,
    title: data.title,
    kind: data.kind === 'test' || data.kind === 'quiz' || data.kind === 'exam' || data.kind === 'coursework' || data.kind === 'lesson_quiz' ? data.kind : 'assignment',
    scaleId: asScale(data.scaleId),
    maxPoints: num(data.maxPoints, 20),
    weight: num(data.weight, 10),
    category: text(data.category, 'Homework'),
    dueAt: text(data.dueAt),
    instructions: text(data.instructions),
    attachments: Array.isArray(data.attachments) ? data.attachments.filter((item): item is string => typeof item === 'string') : [],
    rubric: Array.isArray(data.rubric) ? data.rubric.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const item = row as { criterion?: unknown; points?: unknown };
      return typeof item.criterion === 'string' ? [{ criterion: item.criterion, points: num(item.points) }] : [];
    }) : [],
    latePolicy: {
      allow: data.latePolicy?.allow !== false,
      penaltyPercentPerDay: num(data.latePolicy?.penaltyPercentPerDay),
      cutoffDays: num(data.latePolicy?.cutoffDays),
    },
    lessonLabel: text(data.lessonLabel),
    status: data.status === 'draft' ? 'draft' : 'published',
    studentIds: Array.isArray(data.studentIds) ? data.studentIds.filter((item): item is string => typeof item === 'string') : [],
  };
}

function markFrom(id: string, data: DocumentData): Mark | null {
  if (typeof data.assessmentId !== 'string' || typeof data.studentId !== 'string' || typeof data.classId !== 'string') return null;
  const flag = data.flag === 'missing' || data.flag === 'late' || data.flag === 'excused' ? data.flag : 'none';
  return {
    id,
    assessmentId: data.assessmentId,
    classId: data.classId,
    studentId: data.studentId,
    points: typeof data.points === 'number' ? data.points : null,
    flag,
    comment: text(data.comment),
    state: data.state === 'published' ? 'published' : 'draft',
    enteredBy: text(data.enteredBy),
    updatedAt: text(data.updatedAt),
  };
}

function reportFrom(id: string, data: DocumentData): ReportCard | null {
  if (typeof data.classId !== 'string' || typeof data.studentId !== 'string') return null;
  return {
    id,
    classId: data.classId,
    studentId: data.studentId,
    studentName: text(data.studentName, 'Student'),
    term: text(data.term),
    level: text(data.level),
    subjectComment: text(data.subjectComment),
    formComment: text(data.formComment),
    principalComment: text(data.principalComment),
    status: data.status === 'published' ? 'published' : 'draft',
    token: text(data.token),
    acknowledgement: data.acknowledgement === 'acknowledged' ? 'acknowledged' : 'pending',
    effort: num(data.effort, 1),
  };
}

function goalFrom(id: string, data: DocumentData): AssignedGoal | null {
  if (typeof data.studentId !== 'string' || typeof data.title !== 'string' || typeof data.source !== 'string') return null;
  const source = data.source === 'student' || data.source === 'self' || data.source === 'et_ai' || data.source === 'ai' || data.source === 'teacher' || data.source === 'parent' || data.source === 'institution' ? data.source : 'teacher';
  return {
    id,
    studentId: data.studentId,
    studentName: text(data.studentName, 'Student'),
    classId: text(data.classId),
    title: data.title,
    source,
    assignedBy: text(data.assignedBy),
    assignedByName: text(data.assignedByName),
    due: text(data.due),
    dueTime: text(data.dueTime, '16:00'),
    dueDateKey: text(data.dueDateKey, text(data.due)),
    status: data.status === 'in_progress' || data.status === 'completed' || data.status === 'overdue' ? data.status : 'not_started',
    topic: text(data.topic),
    focusMinutes: num(data.focusMinutes),
    rescheduleCount: num(data.rescheduleCount),
    rescheduleLimit: num(data.rescheduleLimit, 3),
    rescheduleLog: Array.isArray(data.rescheduleLog) ? data.rescheduleLog : [],
    private: data.private === true,
    parentVisibility: data.parentVisibility !== false,
    shareWithTeachers: data.shareWithTeachers === true,
    teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds.filter((item): item is string => typeof item === 'string') : [],
    mirrorId: text(data.mirrorId, id),
  };
}

function institutionFrom(actor: DeskActor, data: DocumentData | undefined, classes: SchoolClass[]): SchoolInstitution {
  const base = emptyDesk(actor).institution;
  const scale = data?.gradeScale && typeof data.gradeScale === 'object' ? data.gradeScale as { defaultScale?: unknown; customBands?: unknown } : null;
  void classes;
  return {
    ...base,
    id: text(data?.institutionId, actor.institutionId),
    name: text(data?.name, base.name),
    campus: text(data?.campus, base.campus),
    kind: data?.kind === 'independent' || data?.kind === 'school' ? data.kind : base.kind,
    defaultScale: asScale(scale?.defaultScale ?? data?.defaultScale ?? base.defaultScale),
    customBands: bands(scale?.customBands ?? data?.customBands).length ? bands(scale?.customBands ?? data?.customBands) : base.customBands,
    teachersCanCreateClasses: data?.teachersCanCreateClasses !== false,
    demo: false,
    branding: text(data?.branding),
  };
}

function assemble(actor: DeskActor, parts: {
  settings?: DocumentData;
  classes: SchoolClass[];
  enrolments: Enrolment[];
  assessments: Assessment[];
  marks: Mark[];
  reports: ReportCard[];
  goals: AssignedGoal[];
}): DeskState {
  const classes = dedupe(parts.classes);
  const base = emptyDesk({ ...actor, institutionId: actor.institutionId, institutionName: actor.institutionName });
  const ids = [
    ...classes.map((item) => item.id),
    ...parts.enrolments.map((item) => item.id),
    ...parts.assessments.map((item) => item.id),
    ...parts.marks.map((item) => item.id),
    ...parts.reports.map((item) => item.id),
    ...parts.goals.map((item) => item.id),
  ];
  return {
    ...base,
    seq: seqFrom(ids),
    actorId: actor.uid,
    actorName: actor.name,
    institution: institutionFrom(actor, parts.settings, classes),
    classes,
    enrolments: dedupe(parts.enrolments),
    assessments: dedupe(parts.assessments),
    marks: dedupe(parts.marks),
    reports: dedupe(parts.reports),
    goals: dedupe(parts.goals).filter((goal) => goal.private !== true),
  };
}

function dedupe<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

function rows<T>(snap: { docs: Array<{ id: string; data: () => DocumentData }> }, map: (id: string, data: DocumentData) => T | null): T[] {
  return snap.docs.flatMap((item) => {
    const row = map(item.id, item.data());
    return row ? [row] : [];
  });
}

/** Live classes, marks, reports, scales, and shared goals for this teacher. */
export function subscribeTeacherDesk(actor: DeskActor, onState: (state: DeskState) => void, onError?: (error: Error) => void): () => void {
  const bucket = {
    settings: undefined as DocumentData | undefined,
    classes: [] as SchoolClass[],
    institutionClasses: [] as SchoolClass[],
    enrolments: [] as Enrolment[],
    institutionEnrolments: [] as Enrolment[],
    assessments: [] as Assessment[],
    institutionAssessments: [] as Assessment[],
    marks: [] as Mark[],
    institutionMarks: [] as Mark[],
    reports: [] as ReportCard[],
    institutionReports: [] as ReportCard[],
    goals: [] as AssignedGoal[],
  };
  const emit = () => {
    onState(assemble(actor, {
      settings: bucket.settings,
      classes: [...bucket.classes, ...bucket.institutionClasses],
      enrolments: [...bucket.enrolments, ...bucket.institutionEnrolments],
      assessments: [...bucket.assessments, ...bucket.institutionAssessments],
      marks: [...bucket.marks, ...bucket.institutionMarks],
      reports: [...bucket.reports, ...bucket.institutionReports],
      goals: bucket.goals,
    }));
  };
  const fail = (error: unknown) => {
    onError?.(error instanceof Error ? error : new Error('Could not read the class record.'));
  };
  const goalStops: Array<() => void> = [];
  let goalKey = '';
  const listenGoals = (studentIds: string[]) => {
    const unique = [...new Set(studentIds.filter(Boolean))].sort();
    const key = unique.join('|');
    if (key === goalKey) return;
    goalKey = key;
    while (goalStops.length) goalStops.pop()?.();
    const byStudent = new Map<string, AssignedGoal[]>();
    bucket.goals = [];
    for (const studentId of unique) {
      goalStops.push(onSnapshot(query(
        collection(db, 'users', studentId, 'goals'),
        where('private', '==', false),
        where('shareWithTeachers', '==', true),
        where('teacherIds', 'array-contains', actor.uid),
      ), (snap) => {
        byStudent.set(studentId, rows(snap, goalFrom));
        bucket.goals = [...byStudent.values()].flat();
        emit();
      }, (error) => {
        console.error(error instanceof Error ? error.message : 'Could not read shared goals.');
      }));
    }
  };
  const syncGoals = () => listenGoals([...bucket.enrolments, ...bucket.institutionEnrolments].map((row) => row.studentId));
  const stops = [
    onSnapshot(doc(db, 'school_settings', actor.uid), (snap) => {
      bucket.settings = snap.exists() ? snap.data() : undefined;
      emit();
    }, fail),
    onSnapshot(query(collection(db, 'school_classes'), where('ownerTeacherId', '==', actor.uid)), (snap) => {
      bucket.classes = rows(snap, classFrom);
      emit();
    }, fail),
    onSnapshot(query(collection(db, 'school_enrolments'), where('ownerTeacherId', '==', actor.uid)), (snap) => {
      bucket.enrolments = rows(snap, enrolmentFrom);
      syncGoals();
      emit();
    }, fail),
    onSnapshot(query(collection(db, 'school_assessments'), where('ownerTeacherId', '==', actor.uid)), (snap) => {
      bucket.assessments = rows(snap, assessmentFrom);
      emit();
    }, fail),
    onSnapshot(query(collection(db, 'school_marks'), where('ownerTeacherId', '==', actor.uid)), (snap) => {
      bucket.marks = rows(snap, markFrom);
      emit();
    }, fail),
    onSnapshot(query(collection(db, 'school_reports'), where('ownerTeacherId', '==', actor.uid)), (snap) => {
      bucket.reports = rows(snap, reportFrom);
      emit();
    }, fail),
  ];
  if (actor.role === 'institution_admin' && actor.institutionId) {
    const inst = actor.institutionId;
    stops.push(
      onSnapshot(query(collection(db, 'school_classes'), where('institutionId', '==', inst)), (snap) => {
        bucket.institutionClasses = rows(snap, classFrom);
        emit();
      }, fail),
      onSnapshot(query(collection(db, 'school_enrolments'), where('institutionId', '==', inst)), (snap) => {
        bucket.institutionEnrolments = rows(snap, enrolmentFrom);
        syncGoals();
        emit();
      }, fail),
      onSnapshot(query(collection(db, 'school_assessments'), where('institutionId', '==', inst)), (snap) => {
        bucket.institutionAssessments = rows(snap, assessmentFrom);
        emit();
      }, fail),
      onSnapshot(query(collection(db, 'school_marks'), where('institutionId', '==', inst)), (snap) => {
        bucket.institutionMarks = rows(snap, markFrom);
        emit();
      }, fail),
      onSnapshot(query(collection(db, 'school_reports'), where('institutionId', '==', inst)), (snap) => {
        bucket.institutionReports = rows(snap, reportFrom);
        emit();
      }, fail),
    );
  }
  return () => {
    for (const stop of stops) stop();
    for (const stop of goalStops) stop();
  };
}

function changed<T extends { id: string }>(prev: T[], next: T[]): { upsert: T[]; remove: T[] } {
  const before = new Map(prev.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  const upsert = next.filter((item) => JSON.stringify(before.get(item.id)) !== JSON.stringify(item));
  const remove = prev.filter((item) => !after.has(item.id));
  return { upsert, remove };
}

function scope(state: DeskState, classId: string): { ownerTeacherId: string; institutionId: string; className: string } {
  const klass = state.classes.find((item) => item.id === classId);
  return {
    ownerTeacherId: klass?.ownerTeacherId || state.actorId,
    institutionId: klass?.institutionId || state.institution.id,
    className: klass?.name || '',
  };
}

function writableGoal(goal: AssignedGoal, actorId: string, role: DeskRole): boolean {
  if (goal.private === true) return false;
  if (goal.source === 'teacher') return goal.assignedBy === actorId;
  if (goal.source === 'institution') return role === 'institution_admin';
  return false;
}

/** Writes the difference. A demo desk and a signed-out actor write nothing. */
export async function persistDeskDiff(prev: DeskState, next: DeskState, role: DeskRole): Promise<void> {
  if (next.institution.demo || prev.institution.demo || !next.actorId) return;
  const classes = changed(prev.classes, next.classes);
  const enrolments = changed(prev.enrolments, next.enrolments);
  const assessments = changed(prev.assessments, next.assessments);
  const marks = changed(prev.marks, next.marks);
  const reports = changed(prev.reports, next.reports);
  const goalPrev = prev.goals.filter((goal) => writableGoal(goal, next.actorId, role));
  const goalNext = next.goals.filter((goal) => writableGoal(goal, next.actorId, role));
  const goals = changed(goalPrev, goalNext);
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const scale = { defaultScale: next.institution.defaultScale, customBands: next.institution.customBands };
  ops.push((batch) => batch.set(doc(db, 'school_settings', next.actorId), plain({
    ownerTeacherId: next.actorId,
    institutionId: next.institution.id,
    name: next.institution.name,
    campus: next.institution.campus,
    kind: next.institution.kind,
    defaultScale: next.institution.defaultScale,
    customBands: next.institution.customBands,
    gradeScale: scale,
    teachersCanCreateClasses: next.institution.teachersCanCreateClasses,
    branding: next.institution.branding,
    demo: false,
  })));
  for (const item of classes.upsert) {
    ops.push((batch) => batch.set(doc(db, 'school_classes', item.id), plain({
      ...item,
      ownerTeacherId: item.ownerTeacherId || next.actorId,
      institutionId: item.institutionId || next.institution.id,
      gradeScale: scale,
    })));
  }
  for (const item of classes.remove) ops.push((batch) => batch.delete(doc(db, 'school_classes', item.id)));
  for (const item of enrolments.upsert) {
    const meta = scope(next, item.classId);
    ops.push((batch) => batch.set(doc(db, 'school_enrolments', item.id), plain({ ...item, ...meta })));
  }
  for (const item of enrolments.remove) ops.push((batch) => batch.delete(doc(db, 'school_enrolments', item.id)));
  for (const item of assessments.upsert) {
    const meta = scope(next, item.classId);
    ops.push((batch) => batch.set(doc(db, 'school_assessments', item.id), plain({ ...item, ownerTeacherId: meta.ownerTeacherId, institutionId: meta.institutionId, className: meta.className })));
  }
  for (const item of assessments.remove) ops.push((batch) => batch.delete(doc(db, 'school_assessments', item.id)));
  for (const item of marks.upsert) {
    const meta = scope(next, item.classId);
    const assessment = next.assessments.find((row) => row.id === item.assessmentId);
    const student = next.enrolments.find((row) => row.studentId === item.studentId);
    ops.push((batch) => batch.set(doc(db, 'school_marks', item.id), plain({
      ...item,
      ownerTeacherId: meta.ownerTeacherId,
      institutionId: meta.institutionId,
      className: meta.className,
      assessmentTitle: assessment?.title || '',
      scaleId: assessment?.scaleId || next.institution.defaultScale,
      maxPoints: assessment?.maxPoints || 0,
      studentName: student?.studentName || '',
    })));
  }
  for (const item of marks.remove) ops.push((batch) => batch.delete(doc(db, 'school_marks', item.id)));
  for (const item of reports.upsert) {
    const meta = scope(next, item.classId);
    ops.push((batch) => batch.set(doc(db, 'school_reports', item.id), plain({
      ...item,
      ownerTeacherId: meta.ownerTeacherId,
      institutionId: meta.institutionId,
      className: meta.className,
    })));
  }
  for (const item of reports.remove) ops.push((batch) => batch.delete(doc(db, 'school_reports', item.id)));
  for (const item of goals.upsert) {
    if (!canEditGoal(item, next.actorId, role) && !goalPrev.some((row) => row.id === item.id) && !writableGoal(item, next.actorId, role)) continue;
    const teacherIds = item.teacherIds.includes(next.actorId) ? item.teacherIds : [...item.teacherIds, next.actorId];
    ops.push((batch) => batch.set(doc(db, 'users', item.studentId, 'goals', item.id), plain({
      ...item,
      private: false,
      shareWithTeachers: true,
      teacherIds,
      institutionId: next.institution.id,
      assignedBy: item.assignedBy || next.actorId,
    })));
  }
  for (const item of goals.remove) {
    if (!canDeleteGoal(item, next.actorId, role)) continue;
    ops.push((batch) => batch.delete(doc(db, 'users', item.studentId, 'goals', item.id)));
  }
  for (let index = 0; index < ops.length; index += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(index, index + 400)) op(batch);
    await batch.commit();
  }
}

