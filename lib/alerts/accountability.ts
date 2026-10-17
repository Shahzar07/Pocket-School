/**
 * Shared accountability for progress and safeguarding alerts.
 * The network branch should import this module for safety alerts too.
 * Due times, checklists, escalation, and the shared plan are pure functions.
 */

import {
  type AlertAuditEntry,
  type AlertSeverity,
  severityAtLeast,
} from './model';

export const STAFF_CHECKLIST = [
  'spoke_to_student',
  'contacted_parent',
  'assigned_recovery_plan',
  'scheduled_extra_session',
  'referred_to_academic_lead',
] as const;

export type StaffChecklist = (typeof STAFF_CHECKLIST)[number];

export const PARENT_CHECKLIST = [
  'talked_with_child',
  'set_study_time',
  'will_attend_meeting',
] as const;

export type ParentChecklist = (typeof PARENT_CHECKLIST)[number];

export const RECOGNITION_BADGES = ['rapid_responder', 'engaged_parent'] as const;
export type RecognitionBadge = (typeof RECOGNITION_BADGES)[number];

export interface SlaWindows {
  mediumHours: number;
  highHours: number;
  criticalHours: number;
  /** Minutes between critical escalation steps. */
  criticalEscalationMinutes: number;
}

export const DEFAULT_SLA: SlaWindows = {
  mediumHours: 48,
  highHours: 24,
  criticalHours: 2,
  criticalEscalationMinutes: 15,
};

export interface PlanTask {
  id: string;
  who: 'student' | 'parent' | 'teacher';
  text: string;
  dueAt: number | null;
  doneAt: number | null;
}

export interface AlertMeeting {
  provider: 'zoom' | 'meet' | 'teams';
  url: string;
  at: number | null;
  agenda: string;
}

/** Stored on both progress and safety alerts. */
export interface AlertAccountability {
  ownerId: string | null;
  ownerName: string;
  coOwnerId: string | null;
  coOwnerName: string;
  delegateId: string | null;
  dueAt: number | null;
  acknowledgedAt: number | null;
  actedAt: number | null;
  staffAction: StaffChecklist | null;
  parentSeenAt: number | null;
  parentActedAt: number | null;
  parentAction: ParentChecklist | null;
  teacherStep: 0 | 1 | 2;
  teacherEscalatedAt: number | null;
  parentStep: 0 | 1 | 2 | 3;
  parentEscalatedAt: number | null;
  teacherPausedMs: number;
  teacherPauseFrom: number | null;
  parentPausedMs: number;
  parentPauseFrom: number | null;
  tasks: PlanTask[];
  agenda: string;
  checkIns: { at: number; authorName: string; text: string }[];
  meeting: AlertMeeting | null;
  recognition: RecognitionBadge[];
}

export interface EscalationNotice {
  to: 'lead' | 'institution' | 'parent_reminder' | 'parent_email' | 'teacher_call';
  detail: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function isStaffChecklist(value: string): value is StaffChecklist {
  return (STAFF_CHECKLIST as readonly string[]).includes(value);
}

export function isParentChecklist(value: string): value is ParentChecklist {
  return (PARENT_CHECKLIST as readonly string[]).includes(value);
}

export function staffActionLabel(action: StaffChecklist): string {
  const labels: Record<StaffChecklist, string> = {
    spoke_to_student: 'Spoke to the student',
    contacted_parent: 'Contacted the family',
    assigned_recovery_plan: 'Assigned the recovery plan',
    scheduled_extra_session: 'Scheduled an extra session',
    referred_to_academic_lead: 'Referred to the academic lead',
  };
  return labels[action];
}

export function parentActionLabel(action: ParentChecklist): string {
  const labels: Record<ParentChecklist, string> = {
    talked_with_child: 'Talked with my child',
    set_study_time: 'Set a study time',
    will_attend_meeting: 'Will attend the meeting',
  };
  return labels[action];
}

export function recognitionLabel(badge: RecognitionBadge): string {
  if (badge === 'rapid_responder') return 'Rapid Responder';
  return 'Engaged Parent';
}

export function mergeSla(partial: Partial<SlaWindows> | null | undefined): SlaWindows {
  const next = { ...DEFAULT_SLA };
  if (!partial) return next;
  for (const key of Object.keys(DEFAULT_SLA) as (keyof SlaWindows)[]) {
    const value = partial[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) next[key] = value;
  }
  return next;
}

export function acknowledgementDue(severity: AlertSeverity, openedAt: number, sla: SlaWindows = DEFAULT_SLA): number | null {
  if (!severityAtLeast(severity, 'medium')) return null;
  const hours = severity === 'critical' ? sla.criticalHours : severity === 'high' ? sla.highHours : sla.mediumHours;
  return openedAt + hours * HOUR_MS;
}

export function emptyAccountability(): AlertAccountability {
  return {
    ownerId: null,
    ownerName: '',
    coOwnerId: null,
    coOwnerName: '',
    delegateId: null,
    dueAt: null,
    acknowledgedAt: null,
    actedAt: null,
    staffAction: null,
    parentSeenAt: null,
    parentActedAt: null,
    parentAction: null,
    teacherStep: 0,
    teacherEscalatedAt: null,
    parentStep: 0,
    parentEscalatedAt: null,
    teacherPausedMs: 0,
    teacherPauseFrom: null,
    parentPausedMs: 0,
    parentPauseFrom: null,
    tasks: [],
    agenda: '',
    checkIns: [],
    meeting: null,
    recognition: [],
  };
}

export function meetingProvider(url: string): AlertMeeting['provider'] | null {
  const value = url.trim();
  if (!value) return null;
  if (/zoom\.us/i.test(value)) return 'zoom';
  if (/meet\.google\.com/i.test(value)) return 'meet';
  if (/teams\.(microsoft|live)\.com/i.test(value)) return 'teams';
  return null;
}

export function meetingFromUrl(url: string, at: number | null, agenda: string): AlertMeeting | null {
  const provider = meetingProvider(url);
  if (!provider) return null;
  return { provider, url: url.trim(), at, agenda };
}

function nextWeekday(now: number, weekday: number): string {
  const date = new Date(now);
  const delta = (weekday - date.getUTCDay() + 7) % 7 || 7;
  return new Date(now + delta * DAY_MS).toISOString().slice(0, 10);
}

export function draftSharedPlan(input: {
  now: number;
  adult: boolean;
  courseTitle: string;
  level: string;
  lessons: readonly { lessonId: string; title: string }[];
  signals: readonly { detail: string }[];
  projectedFinal: number | null;
}): { tasks: PlanTask[]; agenda: string } {
  const lesson = input.lessons.find((item) => item.lessonId && item.title);
  const tasks: PlanTask[] = [];
  if (lesson) {
    tasks.push({
      id: 'student-review',
      who: 'student',
      text: `Finish ${lesson.title} when you are ready.`,
      dueAt: input.now + 7 * DAY_MS,
      doneAt: null,
    });
    if (!input.adult) {
      tasks.push({
        id: 'parent-minutes',
        who: 'parent',
        text: `Keep 20 minutes a day for ${lesson.title}.`,
        dueAt: input.now + 7 * DAY_MS,
        doneAt: null,
      });
    }
    tasks.push({
      id: 'teacher-review',
      who: 'teacher',
      text: `Review ${lesson.title} on ${nextWeekday(input.now, 5)}.`,
      dueAt: input.now + 7 * DAY_MS,
      doneAt: null,
    });
  }
  const lines: string[] = [];
  if (input.courseTitle) lines.push(`Course on record: ${input.courseTitle}.`);
  if (input.level) lines.push(`Level on record: ${input.level}.`);
  for (const signal of input.signals) {
    if (signal.detail) lines.push(signal.detail);
  }
  if (input.projectedFinal != null && Number.isFinite(input.projectedFinal)) {
    lines.push(`Projected course result on record: ${Math.round(input.projectedFinal)}%.`);
  }
  if (lesson) lines.push(`Next lesson on record: ${lesson.title}.`);
  const agenda = lines.length > 0 ? lines.join(' ') : 'No extra items are on the record yet.';
  return { tasks, agenda };
}

function windowMs(severity: AlertSeverity, sla: SlaWindows): number {
  if (severity === 'critical') return sla.criticalEscalationMinutes * 60 * 1000;
  if (severity === 'high') return sla.highHours * HOUR_MS;
  return sla.mediumHours * HOUR_MS;
}

function livePause(from: number | null, now: number): number {
  if (from == null || now <= from) return 0;
  return now - from;
}

export function effectiveDue(input: {
  dueAt: number | null;
  pausedMs: number;
  pauseFrom: number | null;
  now: number;
  critical: boolean;
}): number | null {
  if (input.dueAt == null) return null;
  if (input.critical) return input.dueAt;
  return input.dueAt + input.pausedMs + livePause(input.pauseFrom, input.now);
}

function foldPause(pausedMs: number, pauseFrom: number | null, activeUntil: number | null, now: number): { pausedMs: number; pauseFrom: number | null } {
  if (activeUntil != null && activeUntil > now) {
    return { pausedMs, pauseFrom: pauseFrom ?? now };
  }
  if (pauseFrom != null) {
    return { pausedMs: pausedMs + Math.max(0, now - pauseFrom), pauseFrom: null };
  }
  return { pausedMs, pauseFrom: null };
}

export function advanceAccountability(input: {
  accountability: AlertAccountability;
  severity: AlertSeverity;
  now: number;
  sla: SlaWindows;
  teacherOnLeaveUntil: number | null;
  parentQuiet: boolean;
  studentName: string;
}): { accountability: AlertAccountability; audit: AlertAuditEntry[]; notices: EscalationNotice[] } {
  const critical = input.severity === 'critical';
  const teacherPause = foldPause(
    input.accountability.teacherPausedMs,
    input.accountability.teacherPauseFrom,
    critical ? null : input.teacherOnLeaveUntil,
    input.now,
  );
  const parentPause = foldPause(
    input.accountability.parentPausedMs,
    input.accountability.parentPauseFrom,
    critical || !input.parentQuiet ? null : input.now + 60 * 1000,
    input.now,
  );
  const accountability: AlertAccountability = {
    ...input.accountability,
    teacherPausedMs: teacherPause.pausedMs,
    teacherPauseFrom: teacherPause.pauseFrom,
    parentPausedMs: parentPause.pausedMs,
    parentPauseFrom: parentPause.pauseFrom,
  };
  const audit: AlertAuditEntry[] = [];
  const notices: EscalationNotice[] = [];
  if (!severityAtLeast(input.severity, 'medium') || accountability.dueAt == null) {
    return { accountability, audit, notices };
  }
  const teacherDue = effectiveDue({
    dueAt: accountability.dueAt,
    pausedMs: accountability.teacherPausedMs,
    pauseFrom: accountability.teacherPauseFrom,
    now: input.now,
    critical,
  });
  const parentDue = effectiveDue({
    dueAt: accountability.dueAt,
    pausedMs: accountability.parentPausedMs,
    pauseFrom: accountability.parentPauseFrom,
    now: input.now,
    critical,
  });
  const wait = windowMs(input.severity, input.sla);
  const teacherWaiting = accountability.acknowledgedAt == null || accountability.actedAt == null;
  const teacherAway = !critical && input.teacherOnLeaveUntil != null && input.teacherOnLeaveUntil > input.now;
  if (!teacherAway && teacherWaiting && teacherDue != null && input.now > teacherDue) {
    if (accountability.teacherStep === 0) {
      accountability.teacherStep = 1;
      accountability.teacherEscalatedAt = input.now;
      const detail = `${input.studentName}'s progress plan is still open. The academic lead can take it from here.`;
      notices.push({ to: 'lead', detail });
      audit.push({ at: input.now, actorId: 'et-ai', action: 'escalated', detail });
    } else if (
      accountability.teacherStep === 1
      && accountability.teacherEscalatedAt != null
      && input.now > accountability.teacherEscalatedAt + wait
    ) {
      accountability.teacherStep = 2;
      accountability.teacherEscalatedAt = input.now;
      const detail = `${input.studentName}'s progress plan is still open. The institution admin can help.`;
      notices.push({ to: 'institution', detail });
      audit.push({ at: input.now, actorId: 'et-ai', action: 'escalated', detail });
    }
  }
  const parentWaiting = accountability.coOwnerId != null && (accountability.parentSeenAt == null || accountability.parentActedAt == null);
  const parentHeld = input.parentQuiet && !critical;
  if (parentWaiting && !parentHeld && parentDue != null && input.now > parentDue) {
    if (accountability.parentStep === 0) {
      accountability.parentStep = 1;
      accountability.parentEscalatedAt = input.now;
      const detail = `A reminder is ready for ${input.studentName}'s family. The plan can wait until they have a moment.`;
      notices.push({ to: 'parent_reminder', detail });
      audit.push({ at: input.now, actorId: 'et-ai', action: 'escalated', detail });
    } else if (accountability.parentStep === 1 && accountability.parentEscalatedAt != null && input.now > accountability.parentEscalatedAt + wait) {
      accountability.parentStep = 2;
      accountability.parentEscalatedAt = input.now;
      const detail = `An email is ready for ${input.studentName}'s family about the same plan.`;
      notices.push({ to: 'parent_email', detail });
      audit.push({ at: input.now, actorId: 'et-ai', action: 'escalated', detail });
    } else if (accountability.parentStep === 2 && accountability.parentEscalatedAt != null && input.now > accountability.parentEscalatedAt + wait) {
      accountability.parentStep = 3;
      accountability.parentEscalatedAt = input.now;
      const detail = `When you can, a short call with ${input.studentName}'s family would help.`;
      notices.push({ to: 'teacher_call', detail });
      audit.push({ at: input.now, actorId: 'et-ai', action: 'escalated', detail });
    }
  }
  return { accountability, audit, notices };
}

export function recognitionFor(input: {
  role: 'teacher' | 'parent';
  openedAt: number;
  actedAt: number;
  dueAt: number | null;
}): RecognitionBadge | null {
  if (input.dueAt == null || input.actedAt > input.dueAt) return null;
  if (input.role === 'parent') return 'engaged_parent';
  const window = input.dueAt - input.openedAt;
  if (window <= 0) return null;
  if (input.actedAt - input.openedAt <= window / 2) return 'rapid_responder';
  return null;
}

export interface AccountabilityStatInput {
  polarity: 'concern' | 'positive';
  status: string;
  severity: AlertSeverity;
  adult: boolean;
  level: string;
  courseId: string;
  courseTitle: string;
  createdAt: number;
  acknowledgedAt: number | null;
  actedAt: number | null;
  parentActedAt: number | null;
  overdue: boolean;
  autoResolved: boolean;
}

export interface AccountabilityStats {
  open: number;
  overdue: number;
  averageResponseMs: number | null;
  recovered: number;
  parentActions: number;
  parentExpected: number;
  parentEngagement: number | null;
  interventionSuccess: number | null;
}

export function accountabilityStats(rows: readonly AccountabilityStatInput[], minimum = 5): AccountabilityStats {
  const concern = rows.filter((row) => row.polarity === 'concern');
  const open = concern.filter((row) => row.status !== 'resolved');
  const recovered = rows.filter((row) => row.polarity === 'positive' || (row.status === 'resolved' && row.autoResolved)).length;
  const responses = concern.flatMap((row) => {
    if (row.acknowledgedAt == null) return [];
    return [Math.max(0, row.acknowledgedAt - row.createdAt)];
  });
  const parents = concern.filter((row) => !row.adult);
  const parentActions = parents.filter((row) => row.parentActedAt != null).length;
  const showRates = concern.length >= minimum;
  return {
    open: open.length,
    overdue: open.filter((row) => row.overdue).length,
    averageResponseMs: responses.length > 0 ? Math.round(responses.reduce((sum, value) => sum + value, 0) / responses.length) : null,
    recovered,
    parentActions,
    parentExpected: parents.length,
    parentEngagement: showRates && parents.length > 0 ? parentActions / parents.length : null,
    interventionSuccess: showRates && (recovered + open.length) > 0 ? recovered / (recovered + open.length) : null,
  };
}

export interface LevelAccountability extends AccountabilityStats {
  level: string;
}

export function accountabilityByLevel(rows: readonly AccountabilityStatInput[], minimum = 5): LevelAccountability[] {
  const levels = [...new Set(rows.map((row) => row.level || 'Unassigned'))];
  return levels.flatMap((level) => {
    const group = rows.filter((row) => (row.level || 'Unassigned') === level);
    if (group.length < minimum) return [];
    return [{ level, ...accountabilityStats(group, 1) }];
  });
}

export function weeklyWinLine(wins: readonly { studentName: string; courseTitle: string }[]): string | null {
  const named = wins.filter((win) => win.studentName && win.courseTitle).slice(0, 5);
  if (named.length === 0) return null;
  const people = named.map((win) => `${win.studentName} in ${win.courseTitle}`).join(', ');
  return `This week ${people} came back on track. Thank you for staying with them.`;
}
