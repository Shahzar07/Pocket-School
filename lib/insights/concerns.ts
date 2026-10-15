/**
 * Concern flags are signals for a person. They do not change a mark or a goal.
 */

export const CONCERN_KINDS = ['at_risk', 'study_drop', 'missed_goals', 'chronic_absence', 'wellbeing'] as const;
export type ConcernKind = (typeof CONCERN_KINDS)[number];
export type Severity = 'info' | 'watch' | 'urgent';
export type NotifyRole = 'student' | 'parent' | 'teacher' | 'institution';

export interface ConcernFlag {
  kind: ConcernKind;
  severity: Severity;
  title: string;
  detail: string;
  notify: NotifyRole[];
}

export function buildConcerns(input: {
  atRisk?: boolean;
  studyMinutes?: number;
  previousStudyMinutes?: number;
  missedGoals?: number;
  attendanceRate?: number | null;
  absenceRun?: number;
  mood?: number | null;
}): ConcernFlag[] {
  const flags: ConcernFlag[] = [];
  if (input.atRisk) {
    flags.push({
      kind: 'at_risk',
      severity: 'watch',
      title: 'At risk in class',
      detail: 'Engagement and performance both sit in the needs-a-closer-look corner.',
      notify: ['teacher', 'parent', 'institution'],
    });
  }
  const previous = input.previousStudyMinutes ?? 0;
  const study = input.studyMinutes ?? 0;
  if (previous >= 30 && study < previous / 2) {
    flags.push({
      kind: 'study_drop',
      severity: 'urgent',
      title: 'Sudden drop in study',
      detail: `Study time is ${study} minutes after ${previous} minutes in the previous window.`,
      notify: ['teacher', 'parent'],
    });
  }
  const missed = input.missedGoals ?? 0;
  if (missed >= 1) {
    flags.push({
      kind: 'missed_goals',
      severity: missed >= 3 ? 'urgent' : 'watch',
      title: 'Missed goals',
      detail: `${missed} ${missed === 1 ? 'goal was' : 'goals were'} missed in this window.`,
      notify: ['student', 'parent', 'teacher'],
    });
  }
  const rate = input.attendanceRate;
  const run = input.absenceRun ?? 0;
  if ((rate != null && rate < 90) || run >= 2) {
    flags.push({
      kind: 'chronic_absence',
      severity: run >= 2 ? 'urgent' : 'watch',
      title: run >= 2 ? 'Absence run' : 'Attendance needs a look',
      detail: run >= 2
        ? `${run} absences in a row. Attendance is ${rate == null ? 'not calculated' : `${rate}%`}.`
        : `Attendance is ${rate}%, under 90%.`,
      notify: ['parent', 'teacher', 'institution'],
    });
  }
  if (input.mood != null && input.mood <= 2) {
    flags.push({
      kind: 'wellbeing',
      severity: 'urgent',
      title: 'Wellbeing check-in',
      detail: 'The latest check-in was heavy or low. Only the linked adults see this.',
      notify: ['parent', 'teacher'],
    });
  }
  return flags;
}

export interface RoleChannel {
  inApp: boolean;
  push: boolean;
  kinds: ConcernKind[] | ['all'];
}

export interface NotifySettings {
  quietStart: string;
  quietEnd: string;
  roles: Record<NotifyRole, RoleChannel>;
}

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  quietStart: '21:00',
  quietEnd: '07:00',
  roles: {
    student: { inApp: true, push: true, kinds: ['missed_goals'] },
    parent: { inApp: true, push: true, kinds: ['all'] },
    teacher: { inApp: true, push: true, kinds: ['all'] },
    institution: { inApp: true, push: true, kinds: ['at_risk', 'chronic_absence', 'study_drop'] },
  },
};

function minutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(part => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

/** Quiet hours may cross midnight. Times use the clock on `now`. */
export function inQuietHours(now: Date, start = '21:00', end = '07:00'): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const from = minutes(start);
  const to = minutes(end);
  if (from === to) return false;
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;
}

export function planDelivery(
  flag: ConcernFlag,
  role: NotifyRole,
  settings: NotifySettings,
  now: Date,
): { inApp: boolean; push: boolean; deferred: boolean } {
  const channel = settings.roles[role];
  const allowed = channel.kinds[0] === 'all' || (channel.kinds as ConcernKind[]).includes(flag.kind);
  const addressed = flag.notify.includes(role);
  if (!allowed || !addressed) return { inApp: false, push: false, deferred: false };
  const quiet = inQuietHours(now, settings.quietStart, settings.quietEnd);
  const push = channel.push && !quiet;
  return { inApp: channel.inApp, push, deferred: channel.push && quiet };
}
