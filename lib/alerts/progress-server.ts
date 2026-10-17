import 'server-only';

import { FieldValue, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { toNamedLevel } from '../programmes';
import { notifyUser, parentIdsFor } from '../server/device-push';
import { recordActivity } from '../audit/server';
import { sendPlainEmail } from '../messaging/plain-email';
import { LESSON_FIRST_COMPLETE } from '../events';
import {
  acknowledgementDue,
  accountabilityByLevel,
  accountabilityStats,
  advanceAccountability,
  draftSharedPlan,
  emptyAccountability,
  effectiveDue,
  isParentChecklist,
  isStaffChecklist,
  meetingFromUrl,
  mergeSla,
  parentActionLabel,
  recognitionFor,
  staffActionLabel,
  weeklyWinLine,
  type AlertAccountability,
  type EscalationNotice,
  DEFAULT_SLA,
} from './accountability';
import {
  isAlertSeverity,
  type AlertAuditEntry,
  type AlertNote,
  type AlertSeverity,
  type AlertStatus,
} from './model';
import {
  aggregateLevels,
  evaluateProgress,
  isQuietMinutes,
  mergeThresholds,
  planDelivery,
  type LearnerFacts,
  type LevelCount,
  type NamedLesson,
  type PositiveKind,
  type ProgressAlertView,
  type ProgressEvaluation,
  type ProgressSignal,
  type ProgressSettings,
  type ProgressThresholds,
  type RecoveryPlan,
  type UnitAttemptFact,
  type VisualFact,
} from './progress';

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_LIMIT = 40;
const DAILY_CAP = 80;

export interface ProgressViewer {
  uid: string;
  role: string;
  institutionId: string | null;
  childIds: string[];
  email: string;
  name: string;
  platformAdmin: boolean;
}

type Audience = 'student' | 'parent' | 'staff';

interface StoredAlert {
  id: string;
  type: 'progress';
  polarity: 'concern' | 'positive';
  severity: AlertSeverity;
  status: AlertStatus;
  studentId: string;
  studentName: string;
  adult: boolean;
  independent: boolean;
  level: string;
  courseId: string;
  courseTitle: string;
  institutionId: string | null;
  teacherIds: string[];
  title: string;
  summary: string;
  signals: ProgressSignal[];
  plan: RecoveryPlan;
  safeguardingCaseId: string | null;
  assigneeId: string | null;
  notes: AlertNote[];
  audit: AlertAuditEntry[];
  badge: 'comeback' | null;
  positive: PositiveKind | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  autoResolved: boolean;
  lastNotifiedSeverity: AlertSeverity | null;
  held: boolean;
  streakDays: number;
  accountability: AlertAccountability | null;
}

const DEFAULT_SETTINGS: ProgressSettings = {
  thresholds: mergeThresholds(null),
  parentAlertLevel: 'low',
  quietStart: '21:00',
  quietEnd: '07:00',
  automationEnabled: true,
  academicLeadIds: [],
  sla: DEFAULT_SLA,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const parsed = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return day;
  return new Date(parsed - DAY_MS).toISOString().slice(0, 10);
}

function shiftDay(day: string, days: number): string {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return day;
  return new Date(parsed + days * DAY_MS).toISOString().slice(0, 10);
}

function clock(value: unknown, fallback: string): string {
  const raw = text(value, 5);
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fallback;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    const id = text(item, 128);
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= 20) break;
  }
  return ids;
}

export function parseProgressSettings(value: unknown): ProgressSettings {
  const body = asRecord(value) ?? {};
  const parent = text(body.parentAlertLevel, 16);
  return {
    thresholds: mergeThresholds(asRecord(body.thresholds) as Partial<ProgressThresholds> | null),
    parentAlertLevel: isAlertSeverity(parent) ? parent : 'low',
    quietStart: clock(body.quietStart, '21:00'),
    quietEnd: clock(body.quietEnd, '07:00'),
    automationEnabled: body.automationEnabled !== false,
    academicLeadIds: idList(body.academicLeadIds),
    sla: mergeSla(asRecord(body.sla) as Partial<typeof DEFAULT_SLA> | null),
  };
}

export async function getProgressSettings(institutionId: string | null): Promise<ProgressSettings> {
  const platform = await readSettings('platform');
  if (!institutionId) return platform ?? DEFAULT_SETTINGS;
  const local = await readSettings(institutionId);
  return local ?? platform ?? DEFAULT_SETTINGS;
}

async function readSettings(id: string): Promise<ProgressSettings | null> {
  try {
    const snap = await adminDb().doc(`progress_alert_settings/${id}`).get();
    if (!snap.exists) return null;
    return parseProgressSettings(snap.data());
  } catch (error) {
    console.error('Progress settings unavailable', error);
    return null;
  }
}

export async function saveProgressSettings(
  id: string,
  settings: ProgressSettings,
  actor: ProgressViewer,
): Promise<void> {
  const clean = parseProgressSettings(settings);
  await adminDb().doc(`progress_alert_settings/${id}`).set({
    ...clean,
    updatedAt: Date.now(),
    updatedBy: actor.uid,
  });
  await recordActivity({
    action: 'progress.settings',
    actorId: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'progress_alert_settings',
    targetId: id,
    targetLabel: id === 'platform' ? 'Platform progress alerts' : 'Institution progress alerts',
    after: clean,
    institutionId: id === 'platform' ? undefined : id,
  });
}

function concernId(studentId: string, courseId: string): string {
  return `progress_${studentId}_${courseId || 'general'}`.replace(/\//g, '_');
}

function positiveId(studentId: string, kind: PositiveKind, day: string): string {
  return `progress_positive_${studentId}_${kind}_${day}`.replace(/\//g, '_');
}

function adultOf(user: Record<string, unknown>): boolean {
  if (user.ageTier === 'adult') return true;
  const age = typeof user.age === 'number' ? user.age : null;
  return age != null && age >= 18;
}

function levelOf(user: Record<string, unknown>): string {
  const raw = text(user.level, 80) || text(user.yearGroup, 80) || text(user.pathway, 80);
  return toNamedLevel(raw);
}

function streakFromDates(dates: string[], today: string): { current: number; ended: number } {
  const known = new Set(dates);
  let cursor = today;
  let current = 0;
  while (known.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
    if (current > 400) break;
  }
  if (current > 0) return { current, ended: 0 };
  cursor = previousDay(today);
  let ended = 0;
  while (known.has(cursor)) {
    ended += 1;
    cursor = previousDay(cursor);
    if (ended > 400) break;
  }
  return { current: 0, ended };
}

async function lessonMap(courseId: string, unitIds: string[]): Promise<Map<string, { title: string; visuals: VisualFact[] }>> {
  const map = new Map<string, { title: string; visuals: VisualFact[] }>();
  if (!courseId || courseId === 'general') return map;
  const modules = unitIds.slice(0, 12);
  let extra: string[] = [];
  try {
    const listed = await adminDb().collection(`courses/${courseId}/modules`).limit(12).get();
    extra = listed.docs.map((doc) => doc.id);
  } catch {
    extra = [];
  }
  const ids = [...new Set([...modules, ...extra])].slice(0, 16);
  await Promise.all(ids.map(async (unitId) => {
    try {
      const snap = await adminDb().collection(`courses/${courseId}/modules/${unitId}/lessons`).limit(40).get();
      for (const doc of snap.docs) {
        const data = doc.data();
        const title = text(data.title, 160);
        if (!title) continue;
        const visuals: VisualFact[] = [];
        if (Array.isArray(data.visualBlocks)) {
          for (const block of data.visualBlocks) {
            const row = asRecord(block);
            if (!row) continue;
            const kind = row.kind === 'revisionPoster' || row.kind === 'mindmapImage' ? row.kind : null;
            const src = text(row.src, 500);
            if (!kind || !src) continue;
            visuals.push({ lessonId: doc.id, title, kind, src });
          }
        }
        map.set(doc.id, { title, visuals });
      }
    } catch {
      /* A missing module must not invent lesson titles. */
    }
  }));
  return map;
}

async function safeguardingId(studentId: string): Promise<string | null> {
  try {
    const snap = await adminDb().collection('safeguarding_cases').where('studentId', '==', studentId).limit(5).get();
    const open = snap.docs.find((doc) => {
      const status = text(doc.data().status, 40).toLowerCase();
      return status !== 'resolved' && status !== 'closed';
    });
    if (open) return open.id;
  } catch {
    /* The network branch owns this collection. An empty read is not an error. */
  }
  try {
    const flags = await adminDb().collection('concern_flags').where('studentId', '==', studentId).limit(8).get();
    const flag = flags.docs.find((doc) => {
      const data = doc.data();
      const kind = text(data.kind, 40);
      const status = text(data.status, 40).toLowerCase();
      return kind === 'wellbeing' && status !== 'resolved' && status !== 'closed';
    });
    return flag?.id ?? null;
  } catch {
    return null;
  }
}

async function gatherFacts(
  studentId: string,
  courseId: string,
  now: number,
  openSeverity: AlertSeverity | null,
  previousStreak: number,
): Promise<LearnerFacts | null> {
  const db = adminDb();
  const userSnap = await db.doc(`users/${studentId}`).get();
  if (!userSnap.exists) return null;
  const user = userSnap.data() ?? {};
  const adult = adultOf(user);
  const institutionId = text(user.institutionId, 128) || null;
  const independent = adult && !institutionId;
  const courseSnap = courseId && courseId !== 'general' ? await db.doc(`courses/${courseId}`).get() : null;
  const course = courseSnap?.data() ?? {};
  const enrollSnap = courseId && courseId !== 'general'
    ? await db.doc(`courses/${courseId}/enrollments/${studentId}`).get()
    : null;
  const enrollment = enrollSnap?.data() ?? {};
  const completed = Array.isArray(enrollment.completedLessons)
    ? enrollment.completedLessons.filter((item): item is string => typeof item === 'string')
    : [];
  const completedAt = asRecord(enrollment.lessonCompletedAt) ?? {};
  let lastLessonAt: number | null = null;
  for (const value of Object.values(completedAt)) {
    const at = millis(value);
    if (at != null && (lastLessonAt == null || at > lastLessonAt)) lastLessonAt = at;
  }

  let attemptDocs: QueryDocumentSnapshot[] = [];
  try {
    const snap = await db.collection('unit_quiz_attempts').where('studentId', '==', studentId).limit(ATTEMPT_LIMIT).get();
    attemptDocs = snap.docs.filter((doc) => courseId === 'general' || doc.data().courseId === courseId);
  } catch (error) {
    console.error('Unit attempts unavailable', error);
  }
  attemptDocs.sort((a, b) => (millis(a.data().completedAt) ?? 0) - (millis(b.data().completedAt) ?? 0));

  const unitAttempts: UnitAttemptFact[] = [];
  const scores: number[] = [];
  const sessionMinutes: number[] = [];
  const failCount = new Map<string, { title: string; fails: number }>();
  const bloomMarks = new Map<string, { awarded: number; max: number; attempts: number }>();
  const unitIds: string[] = [];
  const recommended: string[] = [];

  for (const doc of attemptDocs) {
    const data = doc.data();
    const lessonId = text(data.lessonId, 128);
    const percentage = typeof data.percentage === 'number' ? data.percentage : null;
    const version = data.version === 'B' ? 'B' : 'A';
    const passed = data.passed === true;
    const unitTitle = text(data.unitTitle, 160) || text(data.lessonTitle, 160) || lessonId;
    if (lessonId && percentage != null) {
      unitAttempts.push({ lessonId, unitTitle, version, passed, percentage });
      scores.push(percentage);
      if (!passed) {
        const current = failCount.get(lessonId) ?? { title: unitTitle, fails: 0 };
        current.fails += 1;
        if (unitTitle) current.title = unitTitle;
        failCount.set(lessonId, current);
      }
    }
    const minutes = typeof data.timeTakenSeconds === 'number' ? data.timeTakenSeconds / 60 : null;
    if (minutes != null && minutes > 0) sessionMinutes.push(minutes);
    const unitId = text(data.unitId, 128);
    if (unitId && !unitIds.includes(unitId)) unitIds.push(unitId);
    if (Array.isArray(data.recommendedLessonIds)) {
      for (const id of data.recommendedLessonIds) {
        const lesson = text(id, 128);
        if (lesson && !recommended.includes(lesson)) recommended.push(lesson);
      }
    }
    if (Array.isArray(data.responses)) {
      for (const response of data.responses) {
        const row = asRecord(response);
        if (!row) continue;
        const bloom = text(row.bloom, 40);
        if (!bloom) continue;
        const marks = typeof row.marks === 'number' ? row.marks : 1;
        const awarded = typeof row.marksAwarded === 'number' ? row.marksAwarded : row.correct === true ? marks : 0;
        const current = bloomMarks.get(bloom) ?? { awarded: 0, max: 0, attempts: 0 };
        current.awarded += awarded;
        current.max += marks;
        current.attempts += 1;
        bloomMarks.set(bloom, current);
      }
    }
  }

  const lessons = await lessonMap(courseId, unitIds);
  for (const [lessonId, info] of failCount) {
    const known = lessons.get(lessonId);
    if (known) info.title = known.title;
  }

  const reviewLessons: NamedLesson[] = [];
  const visuals: VisualFact[] = [];
  for (const lessonId of recommended) {
    const known = lessons.get(lessonId);
    if (!known) continue;
    reviewLessons.push({ lessonId, title: known.title });
    for (const visual of known.visuals) {
      if (!visuals.some((item) => item.lessonId === visual.lessonId && item.kind === visual.kind)) visuals.push(visual);
    }
  }

  const lessonsPerWeek = typeof course.lessonsPerWeek === 'number' && course.lessonsPerWeek > 0
    ? course.lessonsPerWeek
    : 0;
  const started = millis(enrollment.enrolledAt) ?? millis(enrollment.startedAt) ?? millis(enrollment.createdAt);
  const weeks = started != null ? Math.max(1, Math.floor((now - started) / (7 * DAY_MS)) + 1) : 0;
  const lessonsExpected = lessonsPerWeek > 0 && weeks > 0 ? Math.round(lessonsPerWeek * weeks) : 0;

  const assignments: LearnerFacts['assignments'] = [];
  if (courseId && courseId !== 'general') {
    try {
      const published = await db.collection('assignments').where('courseId', '==', courseId).where('status', '==', 'published').limit(30).get();
      let submitted = new Set<string>();
      try {
        const subs = await db.collection('assignment_submissions').where('studentId', '==', studentId).where('courseId', '==', courseId).limit(40).get();
        submitted = new Set(subs.docs.map((doc) => text(doc.data().assignmentId, 128)).filter(Boolean));
      } catch {
        submitted = new Set();
      }
      for (const doc of published.docs) {
        const data = doc.data();
        const due = millis(data.dueDate);
        const title = text(data.title, 160);
        if (due == null || !title) continue;
        assignments.push({ id: doc.id, title, dueAt: due, submitted: submitted.has(doc.id) });
      }
    } catch {
      /* Missing assignment index leaves the signal empty. */
    }
  }

  const teacherIds = [
    ...idList(course.teacherIds),
    ...idList(enrollment.teacherIds),
    text(course.ownerId, 128),
    text(course.teacherId, 128),
    text(enrollment.teacherId, 128),
  ].filter((id, index, all) => id && all.indexOf(id) === index).slice(0, 20);

  const studyDates = Array.isArray(user.studyDates) ? user.studyDates.filter((item): item is string => typeof item === 'string') : [];
  const streak = streakFromDates(studyDates, dayKey(now));
  const latestScore = scores.length > 0 ? scores[scores.length - 1] ?? null : null;
  const priorScores = scores.length > 1 ? scores.slice(0, -1) : [];
  const latestUnits = new Map<string, number>();
  for (const attempt of unitAttempts) latestUnits.set(attempt.lessonId, attempt.percentage);
  const projectedFinal = latestUnits.size >= 2
    ? [...latestUnits.values()].reduce((sum, score) => sum + score, 0) / latestUnits.size
    : null;

  return {
    studentId,
    studentName: text(user.name, 120) || 'Student',
    level: levelOf(user),
    courseId: courseId || 'general',
    courseTitle: text(course.title, 160) || (courseId === 'general' ? 'Your courses' : 'Course'),
    institutionId,
    teacherIds,
    adult,
    independent,
    now,
    lastLessonAt,
    streakDays: streak.current,
    previousStreakDays: streak.current === 0 ? Math.max(previousStreak, streak.ended) : previousStreak,
    lessonsExpected,
    lessonsCompleted: completed.length,
    unitAttempts,
    priorScores,
    latestScore,
    assignments,
    bloom: [...bloomMarks.entries()].map(([level, marks]) => ({
      level,
      score: marks.max > 0 ? (marks.awarded / marks.max) * 100 : 0,
      attempts: marks.attempts,
    })),
    sessionMinutes: sessionMinutes.slice(-8),
    lessonFailures: [...failCount.entries()]
      .filter(([, info]) => info.title)
      .map(([lessonId, info]) => ({ lessonId, title: info.title, fails: info.fails })),
    projectedFinal,
    safeguardingCaseId: await safeguardingId(studentId),
    reviewLessons,
    visuals,
    openSeverity,
  };
}

function concernCopy(facts: LearnerFacts, evaluation: ProgressEvaluation): { title: string; summary: string } {
  const course = facts.courseTitle || 'this course';
  const severity = evaluation.severity;
  const title = severity === 'critical'
    ? `A plan is ready for ${course}`
    : severity === 'high'
      ? `One lesson at a time in ${course}`
      : severity === 'medium'
        ? `A same-day plan for ${course}`
        : `A short plan for ${course}`;
  const summary = evaluation.signals[0]?.detail || `${facts.studentName} has a progress note in ${course}.`;
  return { title, summary };
}

function positiveCopy(kind: PositiveKind, facts: LearnerFacts): { title: string; summary: string; severity: AlertSeverity } {
  if (kind === 'comeback') {
    return { title: 'Comeback', summary: `${facts.studentName} has come back on track in ${facts.courseTitle}.`, severity: 'low' };
  }
  if (kind === 'streak_restored') {
    return { title: 'Streak restored', summary: `${facts.studentName} has a ${facts.streakDays}-day streak again.`, severity: 'low' };
  }
  if (kind === 'improvement') {
    return { title: 'A stronger score', summary: `${facts.studentName} is above their own average in ${facts.courseTitle}.`, severity: 'low' };
  }
  return { title: 'Back on track', summary: `${facts.studentName} is back on track in ${facts.courseTitle}.`, severity: 'low' };
}

async function readAlert(id: string): Promise<StoredAlert | null> {
  const snap = await adminDb().doc(`progress_alerts/${id}`).get();
  if (!snap.exists) return null;
  return normaliseAlert(snap.id, snap.data() ?? {});
}

function normaliseAlert(id: string, raw: Record<string, unknown>): StoredAlert | null {
  const severity = text(raw.severity, 16);
  const status = text(raw.status, 20);
  if (!isAlertSeverity(severity)) return null;
  if (status !== 'open' && status !== 'acknowledged' && status !== 'assigned' && status !== 'resolved') return null;
  const notes = Array.isArray(raw.notes) ? raw.notes.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const note: AlertNote = {
      at: millis(row.at) ?? 0,
      authorId: text(row.authorId, 128),
      authorName: text(row.authorName, 120) || 'Staff',
      text: text(row.text, 500),
    };
    return note.text ? [note] : [];
  }) : [];
  const audit = Array.isArray(raw.audit) ? raw.audit.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const action = text(row.action, 40);
    const allowed = ['opened', 'acknowledged', 'assigned', 'note', 'resolved', 'auto_resolved', 'notified', 'acted', 'parent_seen', 'parent_acted', 'escalated', 'delegated', 'check_in', 'meeting'] as const;
    if (!(allowed as readonly string[]).includes(action)) return [];
    const entry: AlertAuditEntry = {
      at: millis(row.at) ?? 0,
      actorId: text(row.actorId, 128),
      action: action as AlertAuditEntry['action'],
      detail: text(row.detail, 300),
    };
    return [entry];
  }) : [];
  const plan = asRecord(raw.plan);
  return {
    id,
    type: 'progress',
    polarity: raw.polarity === 'positive' ? 'positive' : 'concern',
    severity,
    status,
    studentId: text(raw.studentId, 128),
    studentName: text(raw.studentName, 120) || 'Student',
    adult: raw.adult === true,
    independent: raw.independent === true,
    level: text(raw.level, 80),
    courseId: text(raw.courseId, 128),
    courseTitle: text(raw.courseTitle, 160),
    institutionId: text(raw.institutionId, 128) || null,
    teacherIds: idList(raw.teacherIds),
    title: text(raw.title, 180),
    summary: text(raw.summary, 400),
    signals: Array.isArray(raw.signals) ? raw.signals.flatMap((item) => {
      const row = asRecord(item);
      if (!row || !isAlertSeverity(text(row.severity, 16))) return [];
      return [{
        id: text(row.id, 40) as ProgressSignal['id'],
        severity: text(row.severity, 16) as AlertSeverity,
        detail: text(row.detail, 300),
      }];
    }) : [],
    plan: {
      studentIntro: text(plan?.studentIntro, 400),
      review: namedList(plan?.review),
      targeted: namedList(plan?.targeted),
      visuals: visualList(plan?.visuals),
      retake: text(plan?.retake, 240),
      parentGuide: text(plan?.parentGuide, 500),
      teacherActions: Array.isArray(plan?.teacherActions) ? plan.teacherActions.map((item) => text(item, 240)).filter(Boolean).slice(0, 8) : [],
    },
    safeguardingCaseId: text(raw.safeguardingCaseId, 128) || null,
    assigneeId: text(raw.assigneeId, 128) || null,
    notes,
    audit,
    badge: raw.badge === 'comeback' ? 'comeback' : null,
    positive: positiveKind(raw.positive),
    createdAt: millis(raw.createdAt) ?? Date.now(),
    updatedAt: millis(raw.updatedAt) ?? Date.now(),
    resolvedAt: millis(raw.resolvedAt),
    autoResolved: raw.autoResolved === true,
    lastNotifiedSeverity: isAlertSeverity(text(raw.lastNotifiedSeverity, 16)) ? text(raw.lastNotifiedSeverity, 16) as AlertSeverity : null,
    held: raw.held === true,
    streakDays: typeof raw.streakDays === 'number' ? raw.streakDays : 0,
    accountability: parseAccountability(raw.accountability),
  };
}

function namedList(value: unknown): NamedLesson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const lessonId = text(row.lessonId, 128);
    const title = text(row.title, 160);
    return lessonId && title ? [{ lessonId, title }] : [];
  }).slice(0, 8);
}

function parseAccountability(value: unknown): AlertAccountability | null {
  const row = asRecord(value);
  if (!row) return null;
  const base = emptyAccountability();
  const staff = text(row.staffAction, 40);
  const parent = text(row.parentAction, 40);
  const teacherStep = row.teacherStep === 1 || row.teacherStep === 2 ? row.teacherStep : 0;
  const parentStep = row.parentStep === 1 || row.parentStep === 2 || row.parentStep === 3 ? row.parentStep : 0;
  const tasks: AlertAccountability['tasks'] = [];
  if (Array.isArray(row.tasks)) {
    for (const item of row.tasks) {
      const task = asRecord(item);
      if (!task) continue;
      let who: 'student' | 'parent' | 'teacher' | null = null;
      if (task.who === 'student' || task.who === 'parent' || task.who === 'teacher') who = task.who;
      const id = text(task.id, 40);
      const label = text(task.text, 240);
      if (!who || !id || !label) continue;
      tasks.push({ id, who, text: label, dueAt: millis(task.dueAt), doneAt: millis(task.doneAt) });
      if (tasks.length >= 8) break;
    }
  }
  const meeting = asRecord(row.meeting);
  const meetingUrl = text(meeting?.url, 500);
  const parsedMeeting = meetingFromUrl(meetingUrl, millis(meeting?.at), text(meeting?.agenda, 800));
  return {
    ...base,
    ownerId: text(row.ownerId, 128) || null,
    ownerName: text(row.ownerName, 120),
    coOwnerId: text(row.coOwnerId, 128) || null,
    coOwnerName: text(row.coOwnerName, 120),
    delegateId: text(row.delegateId, 128) || null,
    dueAt: millis(row.dueAt),
    acknowledgedAt: millis(row.acknowledgedAt),
    actedAt: millis(row.actedAt),
    staffAction: isStaffChecklist(staff) ? staff : null,
    parentSeenAt: millis(row.parentSeenAt),
    parentActedAt: millis(row.parentActedAt),
    parentAction: isParentChecklist(parent) ? parent : null,
    teacherStep,
    teacherEscalatedAt: millis(row.teacherEscalatedAt),
    parentStep,
    parentEscalatedAt: millis(row.parentEscalatedAt),
    teacherPausedMs: typeof row.teacherPausedMs === 'number' ? row.teacherPausedMs : 0,
    teacherPauseFrom: millis(row.teacherPauseFrom),
    parentPausedMs: typeof row.parentPausedMs === 'number' ? row.parentPausedMs : 0,
    parentPauseFrom: millis(row.parentPauseFrom),
    tasks,
    agenda: text(row.agenda, 800),
    checkIns: Array.isArray(row.checkIns) ? row.checkIns.flatMap((item) => {
      const check = asRecord(item);
      if (!check) return [];
      const note = text(check.text, 300);
      return note ? [{ at: millis(check.at) ?? 0, authorName: text(check.authorName, 120) || 'Staff', text: note }] : [];
    }).slice(-12) : [],
    meeting: parsedMeeting,
    recognition: Array.isArray(row.recognition)
      ? row.recognition.flatMap((item) => item === 'rapid_responder' || item === 'engaged_parent' ? [item] : [])
      : [],
  };
}

function visualList(value: unknown): VisualFact[] {
  if (!Array.isArray(value)) return [];
  const visuals: VisualFact[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row) continue;
    const lessonId = text(row.lessonId, 128);
    const title = text(row.title, 160);
    const src = text(row.src, 500);
    if (!lessonId || !title || !src) continue;
    if (row.kind === 'revisionPoster' || row.kind === 'mindmapImage') {
      visuals.push({ lessonId, title, kind: row.kind, src });
    }
    if (visuals.length >= 4) break;
  }
  return visuals;
}

function positiveKind(value: unknown): PositiveKind | null {
  const kind = text(value, 32);
  if (kind === 'recovered' || kind === 'streak_restored' || kind === 'improvement' || kind === 'comeback') return kind;
  return null;
}

function present(alert: StoredAlert, audience: Audience): ProgressAlertView {
  const staff = audience === 'staff';
  const parent = audience === 'parent';
  return {
    id: alert.id,
    type: 'progress',
    polarity: alert.polarity,
    severity: alert.severity,
    status: alert.status,
    studentId: alert.studentId,
    studentName: alert.studentName,
    adult: alert.adult,
    level: alert.level,
    courseId: alert.courseId,
    courseTitle: alert.courseTitle,
    institutionId: alert.institutionId,
    title: alert.title,
    summary: audience === 'student' ? alert.plan.studentIntro || alert.title : alert.summary,
    signals: audience === 'student' ? [] : alert.signals,
    plan: {
      ...alert.plan,
      parentGuide: audience === 'student' ? '' : alert.plan.parentGuide,
      teacherActions: staff ? alert.plan.teacherActions : [],
    },
    safeguardingCaseId: staff ? alert.safeguardingCaseId : null,
    assigneeId: staff ? alert.assigneeId : null,
    badge: alert.badge,
    positive: alert.positive,
    notes: staff || parent ? alert.notes.map((note) => ({ at: note.at, authorName: note.authorName, text: note.text })) : [],
    audit: staff || parent ? alert.audit.map((entry) => ({ at: entry.at, action: entry.action, detail: entry.detail })) : [],
    streakDays: alert.streakDays,
    createdAt: alert.createdAt,
    accountability: alert.accountability ? {
      ownerName: alert.accountability.ownerName,
      coOwnerName: alert.accountability.coOwnerName,
      dueAt: audience === 'student' ? null : effectiveDue({
        dueAt: alert.accountability.dueAt,
        pausedMs: alert.accountability.teacherPausedMs,
        pauseFrom: alert.accountability.teacherPauseFrom,
        now: Date.now(),
        critical: alert.severity === 'critical',
      }),
      acknowledgedAt: alert.accountability.acknowledgedAt,
      actedAt: alert.accountability.actedAt,
      parentSeenAt: alert.accountability.parentSeenAt,
      parentActedAt: alert.accountability.parentActedAt,
      staffAction: alert.accountability.staffAction ? staffActionLabel(alert.accountability.staffAction) : null,
      parentAction: alert.accountability.parentAction ? parentActionLabel(alert.accountability.parentAction) : null,
      overdue: audience !== 'student' && alert.polarity === 'concern' && alert.status !== 'resolved' && alert.accountability.actedAt == null && (() => {
        const due = effectiveDue({
          dueAt: alert.accountability?.dueAt ?? null,
          pausedMs: alert.accountability?.teacherPausedMs ?? 0,
          pauseFrom: alert.accountability?.teacherPauseFrom ?? null,
          now: Date.now(),
          critical: alert.severity === 'critical',
        });
        return due != null && Date.now() > due;
      })(),
      tasks: alert.accountability.tasks.filter((task) => audience === 'staff' || task.who === audience || (audience === 'parent' && task.who === 'student')),
      agenda: audience === 'student' ? '' : alert.accountability.agenda,
      meeting: alert.accountability.meeting,
      teacherStep: staff ? alert.accountability.teacherStep : 0,
      parentStep: audience === 'student' ? 0 : alert.accountability.parentStep,
      recognition: audience === 'student' ? [] : alert.accountability.recognition,
    } : null,
    updatedAt: alert.updatedAt,
    resolvedAt: alert.resolvedAt,
    autoResolved: alert.autoResolved,
  };
}

async function leadIds(institutionId: string | null, settings: ProgressSettings): Promise<string[]> {
  const ids = [...settings.academicLeadIds];
  if (!institutionId) return ids;
  try {
    const snap = await adminDb().collection('users').where('institutionId', '==', institutionId).where('role', '==', 'institution_admin').limit(8).get();
    for (const doc of snap.docs) {
      if (!ids.includes(doc.id)) ids.push(doc.id);
    }
  } catch (error) {
    console.error('Academic leads unavailable', error);
  }
  return ids.slice(0, 20);
}

async function emailOf(userId: string): Promise<string> {
  try {
    const snap = await adminDb().doc(`users/${userId}`).get();
    return text(snap.data()?.email, 200);
  } catch {
    return '';
  }
}

async function deliver(alert: StoredAlert, facts: LearnerFacts, settings: ProgressSettings, now: number): Promise<StoredAlert> {
  if (!settings.automationEnabled || alert.polarity === 'positive') {
    if (alert.polarity === 'positive' && settings.automationEnabled) {
      await notifyUser({
        userId: alert.studentId,
        title: alert.title,
        message: alert.plan.studentIntro || alert.summary,
        type: 'general',
        link: '/dashboard/student/progress',
        pref: 'progress',
      }).catch((error) => console.error('Progress nudge failed', error));
    }
    return alert;
  }
  const quiet = isQuietMinutes(new Date(now).getUTCHours() * 60 + new Date(now).getUTCMinutes(), settings.quietStart, settings.quietEnd);
  const delivery = planDelivery({
    severity: alert.severity,
    adult: facts.adult,
    independent: facts.independent,
    parentMinimum: settings.parentAlertLevel,
    quiet,
    digestDay: new Date(now).getUTCDay() === 1,
  });
  if (alert.lastNotifiedSeverity === alert.severity && !alert.held) return alert;
  if (delivery.heldForQuietHours) {
    return { ...alert, held: true };
  }
  const channels: string[] = [];
  const studentMessage = alert.plan.studentIntro || alert.title;
  await notifyUser({
    userId: alert.studentId,
    title: alert.title,
    message: studentMessage,
    type: 'general',
    link: '/dashboard/student/progress',
    pref: 'progress',
    skipPush: !delivery.studentNudge,
  }).catch((error) => console.error('Student progress notice failed', error));
  channels.push('student');

  if (!facts.adult && (delivery.parentDigest || delivery.parentPush || delivery.parentEmail)) {
    const parents = await parentIdsFor(alert.studentId).catch(() => []);
    const parentMessage = alert.plan.parentGuide || alert.summary;
    await Promise.all(parents.map(async (parentId) => {
      await notifyUser({
        userId: parentId,
        title: delivery.parentDigest ? `Weekly progress note for ${alert.studentName}` : alert.title,
        message: parentMessage,
        type: 'general',
        link: '/dashboard/parent/progress',
        pref: 'progress',
        skipPush: !delivery.parentPush && !delivery.parentDigest,
      }).catch((error) => console.error('Parent progress notice failed', error));
      if (delivery.parentEmail) {
        const email = await emailOf(parentId);
        if (email) {
          try {
            await sendPlainEmail(email, `Poket School progress alert: ${alert.studentName}`, parentMessage);
            channels.push(`email:${parentId}`);
          } catch (error) {
            console.error('Parent progress email skipped', error);
          }
        }
      }
    }));
    if (parents.length > 0) channels.push('parents');
  }

  if (delivery.teacherPush || delivery.teacherEmail) {
    const message = alert.plan.teacherActions[0] || alert.summary;
    await Promise.all(alert.teacherIds.map(async (teacherId) => {
      await notifyUser({
        userId: teacherId,
        title: `${alert.studentName}: ${alert.title}`,
        message,
        type: 'general',
        link: '/dashboard/teacher/progress',
        pref: 'progress',
        skipPush: !delivery.teacherPush,
      }).catch((error) => console.error('Teacher progress notice failed', error));
      if (delivery.teacherEmail) {
        const email = await emailOf(teacherId);
        if (email) {
          try {
            await sendPlainEmail(email, `Poket School progress alert: ${alert.studentName}`, `${alert.summary}\n\n${message}`);
          } catch (error) {
            console.error('Teacher progress email skipped', error);
          }
        }
      }
    }));
    if (alert.teacherIds.length > 0) channels.push('teachers');
  }

  if (delivery.leadPush || delivery.leadEmail) {
    const leads = (await leadIds(alert.institutionId, settings)).filter((id) => id !== alert.studentId);
    const message = alert.plan.teacherActions[0] || alert.summary;
    await Promise.all(leads.map(async (leadId) => {
      await notifyUser({
        userId: leadId,
        title: `${alert.studentName}: ${alert.title}`,
        message,
        type: 'general',
        link: '/dashboard/institution/progress',
        pref: 'progress',
        skipPush: !delivery.leadPush,
      }).catch((error) => console.error('Lead progress notice failed', error));
      if (delivery.leadEmail) {
        const email = await emailOf(leadId);
        if (email) {
          try {
            await sendPlainEmail(email, `Poket School progress alert: ${alert.studentName}`, `${alert.summary}\n\n${message}`);
          } catch (error) {
            console.error('Lead progress email skipped', error);
          }
        }
      }
    }));
    if (leads.length > 0) channels.push('academic-lead');
  }

  const audit: AlertAuditEntry = {
    at: now,
    actorId: 'et-ai',
    action: 'notified',
    detail: channels.join(', ') || 'recorded',
  };
  return {
    ...alert,
    held: false,
    lastNotifiedSeverity: alert.severity,
    audit: [...alert.audit, audit].slice(-80),
  };
}

async function writeAlert(alert: StoredAlert): Promise<void> {
  await adminDb().doc(`progress_alerts/${alert.id}`).set(alert);
}

async function courseIdsFor(studentId: string, courseId?: string): Promise<string[]> {
  if (courseId) return [courseId];
  const ids = new Set<string>();
  try {
    const attempts = await adminDb().collection('unit_quiz_attempts').where('studentId', '==', studentId).limit(ATTEMPT_LIMIT).get();
    for (const doc of attempts.docs) {
      const id = text(doc.data().courseId, 128);
      if (id) ids.add(id);
    }
  } catch (error) {
    console.error('Course discovery from attempts failed', error);
  }
  try {
    const events = await adminDb().collection('events').where('studentId', '==', studentId).where('name', '==', LESSON_FIRST_COMPLETE).limit(20).get();
    for (const doc of events.docs) {
      const id = text(doc.data().courseId, 128);
      if (id) ids.add(id);
    }
  } catch {
    /* The composite index may not be deployed yet. */
  }
  try {
    const enrolled = await adminDb().collectionGroup('enrollments').where('studentId', '==', studentId).limit(20).get();
    for (const doc of enrolled.docs) {
      const fromField = text(doc.data().courseId, 128);
      const fromPath = doc.ref.parent.parent?.id ?? '';
      const id = fromField || fromPath;
      if (id) ids.add(id);
    }
  } catch {
    /* Enrollments often omit studentId. The attempt query is the fallback. */
  }
  if (ids.size === 0) ids.add('general');
  return [...ids].slice(0, 8);
}

async function learnerState(studentId: string, now: number): Promise<{ previous: number; recentPositive: PositiveKind | null }> {
  const snap = await adminDb().doc(`progress_alert_state/${studentId}`).get().catch(() => null);
  const data = snap?.data() ?? {};
  const previous = typeof data.streakDays === 'number' ? data.streakDays : 0;
  const lastAt = millis(data.lastPositiveAt);
  const lastKind = positiveKind(data.lastPositiveKind);
  const recentPositive = lastKind && lastAt != null && now - lastAt < 14 * DAY_MS ? lastKind : null;
  return { previous, recentPositive };
}

async function rememberStreak(studentId: string, streakDays: number, positive: PositiveKind | null, now: number): Promise<void> {
  await adminDb().doc(`progress_alert_state/${studentId}`).set({
    streakDays,
    ...(positive ? { lastPositiveKind: positive, lastPositiveAt: now } : {}),
    updatedAt: now,
  }, { merge: true }).catch((error) => console.error('Progress state was not saved', error));
}

async function personName(userId: string): Promise<string> {
  try {
    const snap = await adminDb().doc(`users/${userId}`).get();
    return text(snap.data()?.name, 120);
  } catch {
    return '';
  }
}

async function leaveUntil(userId: string): Promise<number | null> {
  if (!userId) return null;
  try {
    const snap = await adminDb().doc(`users/${userId}`).get();
    return millis(snap.data()?.leaveUntil) ?? millis(snap.data()?.onLeaveUntil);
  } catch {
    return null;
  }
}

async function courseMeeting(courseId: string, agenda: string): Promise<AlertAccountability['meeting']> {
  if (!courseId || courseId === 'general') return null;
  try {
    const snap = await adminDb().collection('live_classes').where('courseId', '==', courseId).limit(8).get();
    for (const doc of snap.docs) {
      const url = text(doc.data().joinUrl, 500);
      const meeting = meetingFromUrl(url, millis(doc.data().scheduledAt), agenda);
      if (meeting) return meeting;
    }
  } catch (error) {
    console.error('Meeting link unavailable', error);
  }
  return null;
}

async function prepareAccountability(
  facts: LearnerFacts,
  severity: AlertSeverity,
  signals: { detail: string }[],
  now: number,
  settings: ProgressSettings,
  existing: AlertAccountability | null,
): Promise<AlertAccountability> {
  const plan = draftSharedPlan({
    now,
    adult: facts.adult,
    courseTitle: facts.courseTitle,
    level: facts.level,
    lessons: facts.reviewLessons,
    signals,
    projectedFinal: facts.projectedFinal,
  });
  const ownerId = existing?.ownerId || facts.teacherIds[0] || null;
  const ownerName = existing?.ownerName || (ownerId ? await personName(ownerId) : '');
  let coOwnerId = existing?.coOwnerId ?? null;
  let coOwnerName = existing?.coOwnerName ?? '';
  if (!facts.adult && !coOwnerId) {
    const parents = await parentIdsFor(facts.studentId).catch(() => []);
    coOwnerId = parents[0] ?? null;
    coOwnerName = coOwnerId ? await personName(coOwnerId) : '';
  }
  if (facts.adult) {
    coOwnerId = null;
    coOwnerName = '';
  }
  const base = existing ?? emptyAccountability();
  const accountability: AlertAccountability = {
    ...base,
    ownerId,
    ownerName,
    coOwnerId,
    coOwnerName,
    dueAt: base.dueAt ?? acknowledgementDue(severity, now, settings.sla),
    tasks: base.tasks.length > 0 ? base.tasks : plan.tasks,
    agenda: base.agenda || plan.agenda,
    meeting: base.meeting ?? await courseMeeting(facts.courseId, plan.agenda),
  };
  if (accountability.meeting && !accountability.meeting.agenda) {
    accountability.meeting = { ...accountability.meeting, agenda: plan.agenda };
  }
  return accountability;
}

async function sendEscalation(alert: StoredAlert, notices: EscalationNotice[], settings: ProgressSettings): Promise<void> {
  if (!settings.automationEnabled || notices.length === 0) return;
  const leads = settings.academicLeadIds.length > 0 ? settings.academicLeadIds : await leadIds(alert.institutionId, settings);
  const admins = await leadIds(alert.institutionId, settings);
  for (const notice of notices) {
    if (notice.to === 'lead' || notice.to === 'institution' || notice.to === 'teacher_call') {
      const recipients = notice.to === 'teacher_call'
        ? alert.teacherIds
        : notice.to === 'lead'
          ? leads
          : admins;
      await Promise.all(recipients.map((userId) => notifyUser({
        userId,
        title: `${alert.studentName}: progress plan`,
        message: notice.detail,
        type: 'general',
        link: notice.to === 'institution' ? '/dashboard/institution/progress' : '/dashboard/teacher/progress',
        pref: 'progress',
      }).catch((error) => console.error('Escalation notice failed', error))));
    }
    if ((notice.to === 'parent_reminder' || notice.to === 'parent_email') && alert.accountability?.coOwnerId && !alert.adult) {
      const parentId = alert.accountability.delegateId || alert.accountability.coOwnerId;
      await notifyUser({
        userId: parentId,
        title: `A plan for ${alert.studentName}`,
        message: notice.detail,
        type: 'general',
        link: '/dashboard/parent/progress',
        pref: 'progress',
        skipPush: notice.to === 'parent_email',
      }).catch((error) => console.error('Parent reminder failed', error));
      if (notice.to === 'parent_email') {
        const email = await emailOf(parentId);
        if (email) {
          await sendPlainEmail(email, `Poket School progress plan: ${alert.studentName}`, notice.detail)
            .catch((error) => console.error('Parent reminder email skipped', error));
        }
      }
    }
  }
}

async function rememberWin(alert: StoredAlert, now: number): Promise<void> {
  if (!alert.institutionId) return;
  const week = weekStart(now);
  await adminDb().doc(`progress_alert_wins/${alert.institutionId}_${week}`).set({
    institutionId: alert.institutionId,
    week,
    lines: FieldValue.arrayUnion(`${alert.studentName} in ${alert.courseTitle}`),
    sent: false,
  }, { merge: true }).catch((error) => console.error('Weekly win was not saved', error));
}

function weekStart(now: number): string {
  const day = new Date(now).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return dayKey(now + mondayOffset * DAY_MS);
}

export async function noteLearner(studentId: string, courseId?: string, now = Date.now()): Promise<void> {
  try {
    const courses = await courseIdsFor(studentId, courseId);
    for (const course of courses) {
      await evaluateCourse(studentId, course, now);
    }
  } catch (error) {
    console.error('Progress alert was not updated', error);
  }
}

async function evaluateCourse(
  studentId: string,
  courseId: string,
  now: number,
): Promise<'opened' | 'resolved' | 'unchanged'> {
  const state = await learnerState(studentId, now);
  const existing = await readAlert(concernId(studentId, courseId));
  const openSeverity = existing && existing.status !== 'resolved' ? existing.severity : null;
  const facts = await gatherFacts(studentId, courseId, now, openSeverity, state.previous);
  if (!facts) return 'unchanged';
  await rememberStreak(studentId, facts.streakDays, null, now);
  const recentPositive = state.recentPositive;
  const settings = await getProgressSettings(facts.institutionId);
  const evaluation = evaluateProgress(facts, settings.thresholds);
  if (evaluation.severity) {
    const copy = concernCopy(facts, evaluation);
    const base: StoredAlert = {
      id: concernId(studentId, courseId),
      type: 'progress',
      polarity: 'concern',
      severity: evaluation.severity,
      status: existing && existing.status !== 'resolved' ? existing.status : 'open',
      studentId,
      studentName: facts.studentName,
      adult: facts.adult,
      independent: facts.independent,
      level: facts.level,
      courseId: facts.courseId,
      courseTitle: facts.courseTitle,
      institutionId: facts.institutionId,
      teacherIds: facts.teacherIds,
      title: copy.title,
      summary: copy.summary,
      signals: evaluation.signals,
      plan: evaluation.plan,
      safeguardingCaseId: facts.safeguardingCaseId,
      assigneeId: existing?.assigneeId ?? null,
      notes: existing?.notes ?? [],
      audit: existing?.audit ?? [],
      badge: null,
      positive: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      resolvedAt: null,
      autoResolved: false,
      lastNotifiedSeverity: existing?.status === 'resolved' ? null : existing?.lastNotifiedSeverity ?? null,
      held: existing?.status === 'resolved' ? false : existing?.held ?? false,
      streakDays: facts.streakDays,
      accountability: existing?.status === 'resolved' ? null : existing?.accountability ?? null,
    };
    if (!existing || existing.status === 'resolved' || existing.severity !== evaluation.severity) {
      const opened: AlertAuditEntry = {
        at: now,
        actorId: 'et-ai',
        action: 'opened',
        detail: evaluation.signals.map((signal) => signal.id).join(', '),
      };
      base.audit = [...base.audit, opened].slice(-80);
    }
    const quiet = isQuietMinutes(new Date(now).getUTCHours() * 60 + new Date(now).getUTCMinutes(), settings.quietStart, settings.quietEnd);
    const prepared = await prepareAccountability(facts, evaluation.severity, evaluation.signals, now, settings, base.accountability);
    const moved = advanceAccountability({
      accountability: prepared,
      severity: evaluation.severity,
      now,
      sla: settings.sla,
      teacherOnLeaveUntil: prepared.ownerId ? await leaveUntil(prepared.ownerId) : null,
      parentQuiet: quiet,
      studentName: facts.studentName,
    });
    base.accountability = moved.accountability;
    base.assigneeId = base.assigneeId || prepared.ownerId;
    base.audit = [...base.audit, ...moved.audit].slice(-80);
    const delivered = await deliver(base, facts, settings, now);
    await sendEscalation(delivered, moved.notices, settings);
    await writeAlert(delivered);
    return existing && existing.status !== 'resolved' ? 'unchanged' : 'opened';
  }

  let outcome: 'opened' | 'resolved' | 'unchanged' = 'unchanged';
  if (existing && existing.status !== 'resolved') {
    await writeAlert({
      ...existing,
      status: 'resolved',
      resolvedAt: now,
      autoResolved: true,
      updatedAt: now,
      held: false,
      audit: [...existing.audit, { at: now, actorId: 'et-ai', action: 'auto_resolved' as const, detail: 'The recorded metrics recovered.' }].slice(-80),
    });
    await rememberWin(existing, now);
    outcome = 'resolved';
  }
  if (evaluation.positive && evaluation.positive !== recentPositive) {
    const copy = positiveCopy(evaluation.positive, facts);
    const positive: StoredAlert = {
      id: positiveId(studentId, evaluation.positive, dayKey(now)),
      type: 'progress',
      polarity: 'positive',
      severity: copy.severity,
      status: 'open',
      studentId,
      studentName: facts.studentName,
      adult: facts.adult,
      independent: facts.independent,
      level: facts.level,
      courseId: facts.courseId,
      courseTitle: facts.courseTitle,
      institutionId: facts.institutionId,
      teacherIds: facts.teacherIds,
      title: copy.title,
      summary: copy.summary,
      signals: [],
      plan: evaluation.plan,
      safeguardingCaseId: null,
      assigneeId: null,
      notes: [],
      audit: [{ at: now, actorId: 'et-ai', action: 'opened', detail: evaluation.positive }],
      badge: evaluation.badge,
      positive: evaluation.positive,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      autoResolved: false,
      lastNotifiedSeverity: null,
      held: false,
      streakDays: facts.streakDays,
      accountability: null,
    };
    await deliver(positive, facts, settings, now);
    await writeAlert(positive);
    await rememberStreak(studentId, facts.streakDays, evaluation.positive, now);
  }
  return outcome;
}

export async function runDailyProgressAlerts(now = Date.now()): Promise<{ checked: number; opened: number; resolved: number }> {
  const pairs = new Map<string, { studentId: string; courseId: string }>();
  const add = (studentId: string, courseId: string) => {
    if (!studentId || pairs.size >= DAILY_CAP) return;
    pairs.set(`${studentId}:${courseId || 'general'}`, { studentId, courseId: courseId || 'general' });
  };
  try {
    const recent = await adminDb().collection('unit_quiz_attempts').orderBy('completedAt', 'desc').limit(60).get();
    for (const doc of recent.docs) add(text(doc.data().studentId, 128), text(doc.data().courseId, 128));
  } catch (error) {
    console.error('Recent unit attempts were not scanned', error);
  }
  try {
    const open = await adminDb().collection('progress_alerts').where('type', '==', 'progress').limit(200).get();
    for (const doc of open.docs) {
      const data = doc.data();
      if (data.status === 'resolved' || data.polarity === 'positive') continue;
      add(text(data.studentId, 128), text(data.courseId, 128));
    }
  } catch (error) {
    console.error('Open progress alerts were not scanned', error);
  }

  let opened = 0;
  let resolved = 0;
  const institutions = new Map<string, StoredAlert[]>();
  for (const pair of pairs.values()) {
    const before = await readAlert(concernId(pair.studentId, pair.courseId)).catch(() => null);
    const outcome = await evaluateCourse(pair.studentId, pair.courseId, now).catch((error) => {
      console.error('Daily progress check failed', error);
      return 'unchanged' as const;
    });
    if (outcome === 'opened') opened += 1;
    if (outcome === 'resolved') resolved += 1;
    const after = await readAlert(concernId(pair.studentId, pair.courseId)).catch(() => before);
    if (after && after.institutionId && after.polarity === 'concern' && after.status !== 'resolved') {
      const list = institutions.get(after.institutionId) ?? [];
      list.push(after);
      institutions.set(after.institutionId, list);
    }
  }
  const day = dayKey(now);
  for (const [institutionId, alerts] of institutions) {
    await writeTrend(institutionId, day, alerts, now);
  }
  const all = [...institutions.values()].flat();
  if (all.length > 0) await writeTrend('platform', day, all, now);
  await sendWeeklySummaries(now);
  return { checked: pairs.size, opened, resolved };
}

async function sendWeeklySummaries(now: number): Promise<void> {
  if (new Date(now).getUTCDay() !== 1) return;
  try {
    const snap = await adminDb().collection('progress_alert_wins').where('sent', '==', false).limit(20).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const lines = Array.isArray(data.lines) ? data.lines.filter((item): item is string => typeof item === 'string') : [];
      const wins = lines.flatMap((line) => {
        const split = line.split(' in ');
        const studentName = split[0]?.trim() ?? '';
        const courseTitle = split.slice(1).join(' in ').trim();
        return studentName && courseTitle ? [{ studentName, courseTitle }] : [];
      });
      const message = weeklyWinLine(wins);
      if (message && typeof data.institutionId === 'string') {
        const settings = await getProgressSettings(data.institutionId);
        const leads = await leadIds(data.institutionId, settings);
        await Promise.all(leads.map((userId) => notifyUser({
          userId,
          title: 'Weekly progress wins',
          message,
          type: 'general',
          link: '/dashboard/institution/progress',
          pref: 'progress',
        }).catch((error) => console.error('Weekly summary failed', error))));
      }
      await doc.ref.set({ sent: true }, { merge: true });
    }
  } catch (error) {
    console.error('Weekly summaries were not sent', error);
  }
}

async function writeTrend(institutionId: string, day: string, alerts: StoredAlert[], now: number): Promise<void> {
  const counts = { low: 0, medium: 0, high: 0, critical: 0, total: alerts.length };
  for (const alert of alerts) counts[alert.severity] += 1;
  await adminDb().doc(`progress_alert_trends/${institutionId}_${day}`).set({
    institutionId,
    day,
    ...counts,
    at: now,
  }).catch((error) => console.error('Progress trend was not saved', error));
}

export interface ProgressList {
  alerts: ProgressAlertView[];
  levels: LevelCount[];
  trend: { day: string; low: number; medium: number; high: number; critical: number; total: number } | null;
  previous: { day: string; low: number; medium: number; high: number; critical: number; total: number } | null;
  stats: ReturnType<typeof accountabilityStats>;
  levelStats: ReturnType<typeof accountabilityByLevel>;
}

function emptyList(): ProgressList {
  return {
    alerts: [],
    levels: [],
    trend: null,
    previous: null,
    stats: accountabilityStats([]),
    levelStats: [],
  };
}

function statRows(alerts: readonly StoredAlert[]) {
  const now = Date.now();
  return alerts.map((alert) => {
    const due = effectiveDue({
      dueAt: alert.accountability?.dueAt ?? null,
      pausedMs: alert.accountability?.teacherPausedMs ?? 0,
      pauseFrom: alert.accountability?.teacherPauseFrom ?? null,
      now,
      critical: alert.severity === 'critical',
    });
    return {
      polarity: alert.polarity,
      status: alert.status,
      severity: alert.severity,
      adult: alert.adult,
      level: alert.level,
      courseId: alert.courseId,
      courseTitle: alert.courseTitle,
      createdAt: alert.createdAt,
      acknowledgedAt: alert.accountability?.acknowledgedAt ?? null,
      actedAt: alert.accountability?.actedAt ?? null,
      parentActedAt: alert.accountability?.parentActedAt ?? null,
      overdue: alert.polarity === 'concern' && alert.status !== 'resolved' && due != null && now > due && alert.accountability?.actedAt == null,
      autoResolved: alert.autoResolved,
    };
  });
}

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];

function sortAlerts(alerts: StoredAlert[]): StoredAlert[] {
  return [...alerts].sort((a, b) => {
    const rank = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (a.polarity !== b.polarity) return a.polarity === 'concern' ? -1 : 1;
    if (rank !== 0) return rank;
    return b.updatedAt - a.updatedAt;
  });
}

async function loadQuery(build: () => Promise<QuerySnapshot>): Promise<StoredAlert[]> {
  try {
    const snap = await build();
    return snap.docs.flatMap((doc) => {
      const alert = normaliseAlert(doc.id, doc.data());
      return alert ? [alert] : [];
    });
  } catch (error) {
    console.error('Progress alert query failed', error);
    return [];
  }
}

export async function listProgressAlerts(
  viewer: ProgressViewer,
  scope: 'student' | 'child' | 'class' | 'institution' | 'platform',
  childId?: string,
): Promise<ProgressList> {
  let audience: Audience = 'staff';
  let rows: StoredAlert[] = [];
  if (scope === 'student') {
    audience = 'student';
    rows = await loadQuery(() => adminDb().collection('progress_alerts').where('studentId', '==', viewer.uid).limit(40).get());
  } else if (scope === 'child') {
    audience = 'parent';
    const id = childId && viewer.childIds.includes(childId) ? childId : '';
    if (!id) return emptyList();
    const child = await adminDb().doc(`users/${id}`).get();
    if (adultOf(child.data() ?? {})) return emptyList();
    rows = await loadQuery(() => adminDb().collection('progress_alerts').where('studentId', '==', id).limit(40).get());
    rows = rows.filter((alert) => !alert.adult);
  } else if (scope === 'class') {
    const taught = await loadQuery(() => adminDb().collection('progress_alerts').where('teacherIds', 'array-contains', viewer.uid).limit(80).get());
    const assigned = await loadQuery(() => adminDb().collection('progress_alerts').where('assigneeId', '==', viewer.uid).limit(40).get());
    const seen = new Set<string>();
    rows = [...taught, ...assigned].filter((alert) => {
      if (seen.has(alert.id)) return false;
      seen.add(alert.id);
      return true;
    });
  } else if (scope === 'institution') {
    if (!viewer.institutionId) return emptyList();
    rows = await loadQuery(() => adminDb().collection('progress_alerts').where('institutionId', '==', viewer.institutionId).limit(120).get());
  } else {
    rows = await loadQuery(() => adminDb().collection('progress_alerts').where('type', '==', 'progress').limit(200).get());
  }
  const sorted = sortAlerts(rows);
  const open = sorted.filter((alert) => alert.polarity === 'concern' && alert.status !== 'resolved');
  const levels = scope === 'institution' || scope === 'platform'
    ? aggregateLevels(open.map((alert) => ({ level: alert.level, severity: alert.severity })))
    : [];
  const trendScope = scope === 'platform' ? 'platform' : viewer.institutionId;
  const trend = trendScope && (scope === 'institution' || scope === 'platform') ? await readTrend(trendScope, dayKey(Date.now())) : null;
  const previous = trendScope && (scope === 'institution' || scope === 'platform') ? await readTrend(trendScope, shiftDay(dayKey(Date.now()), -7)) : null;
  const statsInput = statRows(sorted);
  return {
    alerts: sorted.map((alert) => present(alert, audience)),
    levels,
    trend,
    previous,
    stats: accountabilityStats(statsInput, scope === 'institution' || scope === 'platform' ? 5 : 1),
    levelStats: scope === 'institution' || scope === 'platform' ? accountabilityByLevel(statsInput) : [],
  };
}

async function readTrend(institutionId: string, day: string): Promise<ProgressList['trend']> {
  try {
    const snap = await adminDb().doc(`progress_alert_trends/${institutionId}_${day}`).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return {
      day,
      low: Number(data.low) || 0,
      medium: Number(data.medium) || 0,
      high: Number(data.high) || 0,
      critical: Number(data.critical) || 0,
      total: Number(data.total) || 0,
    };
  } catch {
    return null;
  }
}

const WORKFLOW_ACTIONS = ['acknowledge', 'assign', 'note', 'resolve', 'act', 'seen', 'parent_act', 'delegate', 'check_in', 'meeting'] as const;
export type ProgressWorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

function staffViewer(viewer: ProgressViewer, alert: StoredAlert): boolean {
  return viewer.platformAdmin
    || (viewer.role === 'institution_admin' && !!alert.institutionId && viewer.institutionId === alert.institutionId)
    || alert.teacherIds.includes(viewer.uid)
    || alert.assigneeId === viewer.uid
    || alert.accountability?.ownerId === viewer.uid;
}

function parentViewer(viewer: ProgressViewer, alert: StoredAlert): boolean {
  if (alert.adult || viewer.role !== 'parent') return false;
  return viewer.childIds.includes(alert.studentId) || alert.accountability?.delegateId === viewer.uid || alert.accountability?.coOwnerId === viewer.uid;
}

export function progressPermission(
  viewer: ProgressViewer,
  alert: StoredAlert,
  action: ProgressWorkflowAction,
): string | null {
  const staff = staffViewer(viewer, alert);
  const parent = parentViewer(viewer, alert);
  if (action === 'acknowledge' && alert.studentId === viewer.uid) return null;
  if (action === 'seen' || action === 'parent_act' || action === 'delegate') return parent ? null : 'You cannot update this progress alert.';
  if (action === 'act' || action === 'meeting') return staff ? null : 'You cannot update this progress alert.';
  if (action === 'check_in' || action === 'note') return staff || parent ? null : 'You cannot update this progress alert.';
  if (staff && (action === 'acknowledge' || action === 'assign' || action === 'resolve')) return null;
  return 'You cannot update this progress alert.';
}

export async function applyProgressWorkflow(input: {
  id: string;
  action: ProgressWorkflowAction;
  viewer: ProgressViewer;
  assigneeId?: string;
  note?: string;
  checklist?: string;
  meetingUrl?: string;
  meetingAt?: number;
  now?: number;
}): Promise<ProgressAlertView> {
  const alert = await readAlert(input.id);
  if (!alert) throw new Error('Progress alert not found');
  const denied = progressPermission(input.viewer, alert, input.action);
  if (denied) throw new Error(denied);
  const now = input.now ?? Date.now();
  const next: StoredAlert = { ...alert, updatedAt: now, accountability: alert.accountability ? { ...alert.accountability } : emptyAccountability() };
  const account = next.accountability ?? emptyAccountability();
  const entry = (action: AlertAuditEntry['action'], detail: string): AlertAuditEntry => ({
    at: now,
    actorId: input.viewer.uid,
    action,
    detail,
  });
  if (input.action === 'acknowledge') {
    if (next.status === 'open') next.status = 'acknowledged';
    if (input.viewer.uid !== alert.studentId) account.acknowledgedAt = account.acknowledgedAt ?? now;
    next.audit = [...next.audit, entry('acknowledged', input.viewer.name || input.viewer.uid)];
  } else if (input.action === 'assign') {
    const assigneeId = text(input.assigneeId, 128);
    if (!assigneeId) throw new Error('Choose someone to assign.');
    next.assigneeId = assigneeId;
    account.ownerId = assigneeId;
    account.ownerName = await personName(assigneeId);
    next.status = 'assigned';
    next.audit = [...next.audit, entry('assigned', assigneeId)];
  } else if (input.action === 'note' || input.action === 'check_in') {
    const body = text(input.note, 500);
    if (!body) throw new Error('Write a note first.');
    if (input.action === 'note') {
      next.notes = [...next.notes, { at: now, authorId: input.viewer.uid, authorName: input.viewer.name || 'Staff', text: body }].slice(-40);
      next.audit = [...next.audit, entry('note', body)];
    } else {
      account.checkIns = [...account.checkIns, { at: now, authorName: input.viewer.name || 'Staff', text: body }].slice(-12);
      next.audit = [...next.audit, entry('check_in', body)];
    }
  } else if (input.action === 'act') {
    if (account.acknowledgedAt == null && input.viewer.uid !== alert.studentId) {
      throw new Error('Acknowledge the alert before logging the action.');
    }
    const checklist = text(input.checklist, 40);
    if (!isStaffChecklist(checklist)) throw new Error('Choose an action from the list.');
    account.staffAction = checklist;
    account.actedAt = now;
    const badge = recognitionFor({ role: 'teacher', openedAt: next.createdAt, actedAt: now, dueAt: account.dueAt });
    if (badge && !account.recognition.includes(badge)) account.recognition = [...account.recognition, badge];
    const extra = text(input.note, 500);
    next.audit = [...next.audit, entry('acted', extra ? `${staffActionLabel(checklist)}. ${extra}` : staffActionLabel(checklist))];
    if (badge && account.ownerId) {
      await adminDb().doc(`progress_alert_recognition/${account.ownerId}`).set({
        userId: account.ownerId,
        institutionId: next.institutionId,
        badges: FieldValue.arrayUnion(badge),
        updatedAt: now,
      }, { merge: true }).catch((error) => console.error('Recognition was not saved', error));
    }
  } else if (input.action === 'seen') {
    account.parentSeenAt = now;
    next.audit = [...next.audit, entry('parent_seen', "I've seen this")];
  } else if (input.action === 'parent_act') {
    if (account.parentSeenAt == null) throw new Error("Confirm you have seen this before choosing an action.");
    const checklist = text(input.checklist, 40);
    if (!isParentChecklist(checklist)) throw new Error('Choose an action from the list.');
    account.parentAction = checklist;
    account.parentActedAt = now;
    const badge = recognitionFor({ role: 'parent', openedAt: next.createdAt, actedAt: now, dueAt: account.dueAt });
    if (badge && !account.recognition.includes(badge)) account.recognition = [...account.recognition, badge];
    const extra = text(input.note, 500);
    next.audit = [...next.audit, entry('parent_acted', extra ? `${parentActionLabel(checklist)}. ${extra}` : parentActionLabel(checklist))];
    if (badge) {
      await adminDb().doc(`progress_alert_recognition/${input.viewer.uid}`).set({
        userId: input.viewer.uid,
        institutionId: next.institutionId,
        badges: FieldValue.arrayUnion(badge),
        updatedAt: now,
      }, { merge: true }).catch((error) => console.error('Recognition was not saved', error));
    }
  } else if (input.action === 'delegate') {
    const delegateId = text(input.assigneeId, 128);
    if (!delegateId || delegateId === input.viewer.uid) throw new Error('Choose another linked guardian.');
    const delegate = await adminDb().doc(`users/${delegateId}`).get();
    const children = idList(delegate.data()?.childIds);
    if (!children.includes(alert.studentId)) throw new Error('That guardian is not linked to this learner.');
    account.delegateId = delegateId;
    account.coOwnerId = delegateId;
    account.coOwnerName = text(delegate.data()?.name, 120) || 'Guardian';
    next.audit = [...next.audit, entry('delegated', account.coOwnerName)];
  } else if (input.action === 'meeting') {
    const url = text(input.meetingUrl, 500);
    const meeting = meetingFromUrl(url, typeof input.meetingAt === 'number' ? input.meetingAt : null, account.agenda);
    if (!meeting) throw new Error('Use a Zoom, Meet, or Teams link.');
    account.meeting = meeting;
    next.audit = [...next.audit, entry('meeting', `${meeting.provider} ${meeting.url}`)];
  } else {
    next.status = 'resolved';
    next.resolvedAt = now;
    next.autoResolved = false;
    next.audit = [...next.audit, entry('resolved', 'Marked resolved.')];
  }
  next.accountability = account;
  next.audit = next.audit.slice(-80);
  await writeAlert(next);
  await recordActivity({
    action: `progress.${input.action}`,
    actorId: input.viewer.uid,
    actorEmail: input.viewer.email,
    actorRole: input.viewer.role,
    targetType: 'progress_alert',
    targetId: next.id,
    targetLabel: next.studentName,
    institutionId: next.institutionId ?? undefined,
    after: { status: next.status, assigneeId: next.assigneeId },
  });
  const audience: Audience = next.studentId === input.viewer.uid ? 'student' : input.viewer.role === 'parent' ? 'parent' : 'staff';
  return present(next, audience);
}

export async function viewerFromProfile(uid: string, email: string, platformAdmin: boolean): Promise<ProgressViewer> {
  const snap = await adminDb().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  return {
    uid,
    role: text(data.role, 40) || (platformAdmin ? 'admin' : 'student'),
    institutionId: text(data.institutionId, 128) || null,
    childIds: idList(data.childIds),
    email,
    name: text(data.name, 120),
    platformAdmin,
  };
}
