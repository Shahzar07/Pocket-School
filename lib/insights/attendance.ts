export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceMark {
  dateKey: string;
  status: AttendanceStatus;
  studentId: string;
  courseId?: string;
  classId?: string;
  institutionId?: string;
  source: 'automatic' | 'manual';
  note?: string;
}

/** Automatic mark. A holiday is not an absence. Manual entry always wins later. */
export function automaticStatus(input: {
  holiday: boolean;
  joinedLive: boolean;
  openedLesson: boolean;
  submittedWork: boolean;
}): AttendanceStatus | 'skip' {
  if (input.holiday) return 'skip';
  if (input.joinedLive || input.openedLesson || input.submittedWork) return 'present';
  return 'absent';
}

export function resolveMark(manual: AttendanceStatus | undefined, automatic: AttendanceStatus | 'skip'): AttendanceStatus | 'skip' {
  if (manual) return manual;
  return automatic;
}

export function attendanceRate(marks: AttendanceMark[], holidays: readonly string[]): number | null {
  const holiday = new Set(holidays);
  const counted = marks.filter(m => !holiday.has(m.dateKey) && m.status !== 'excused');
  if (!counted.length) return null;
  const present = counted.filter(m => m.status === 'present' || m.status === 'late').length;
  return Math.round((100 * present) / counted.length);
}

/** How many trailing counted marks are absences. */
export function absenceRun(marks: AttendanceMark[], holidays: readonly string[]): number {
  const holiday = new Set(holidays);
  const ordered = [...marks]
    .filter(m => !holiday.has(m.dateKey) && m.status !== 'excused')
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let run = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].status !== 'absent') break;
    run += 1;
  }
  return run;
}

export function shouldAlertAbsence(marks: AttendanceMark[], holidays: readonly string[]): boolean {
  return absenceRun(marks, holidays) >= 2;
}

/** Missing 10% or more of counted days. Excused days and holidays are already out of the rate. */
export const CHRONIC_ABSENCE_BELOW = 90;

export interface SessionSignal {
  dateKey: string;
  studentId: string;
  courseId?: string;
  holiday: boolean;
  loggedIn: boolean;
  joinedLive: boolean;
  scheduledSession: boolean;
  openedLesson: boolean;
  submittedWork: boolean;
  /** Minutes after the scheduled start. More than 10 counts as late when they still attended. */
  minutesLate?: number;
}

/**
 * A scheduled class with a login, a live join, an opened lesson, or submitted work is attendance.
 * A scheduled class with none of those is an absence. A holiday is not stored.
 */
export function automaticMark(signal: SessionSignal): AttendanceMark | null {
  if (signal.holiday) return null;
  const session = signal.scheduledSession || signal.joinedLive || signal.openedLesson || signal.submittedWork;
  if (!session) return null;
  const attended = signal.joinedLive || signal.openedLesson || signal.submittedWork || (signal.scheduledSession && signal.loggedIn);
  let status: AttendanceStatus = attended ? 'present' : 'absent';
  if (status === 'present' && (signal.minutesLate ?? 0) > 10) status = 'late';
  return {
    dateKey: signal.dateKey,
    studentId: signal.studentId,
    courseId: signal.courseId,
    status,
    source: 'automatic',
  };
}

/** A teacher mark replaces the automatic one for the same student, course, and day. */
export function mergeMarks(automatic: AttendanceMark[], manual: AttendanceMark[]): AttendanceMark[] {
  const key = (mark: AttendanceMark) => `${mark.studentId}|${mark.courseId ?? ''}|${mark.dateKey}`;
  const map = new Map<string, AttendanceMark>();
  for (const mark of automatic) map.set(key(mark), mark);
  for (const mark of manual) {
    const prior = map.get(key(mark));
    const status = resolveMark(mark.status, prior?.status ?? 'skip');
    if (status === 'skip') continue;
    map.set(key(mark), { ...prior, ...mark, status, source: 'manual' });
  }
  return [...map.values()];
}

export interface AttendanceSummary {
  rate: number | null;
  streak: number;
  chronic: boolean;
  present: number;
  late: number;
  absent: number;
  excused: number;
  counted: number;
}

export function attendanceStreak(marks: AttendanceMark[], holidays: readonly string[]): number {
  const holiday = new Set(holidays);
  const days = [...new Set(marks.filter(mark => !holiday.has(mark.dateKey)).map(mark => mark.dateKey))].sort();
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = marks.filter(mark => mark.dateKey === days[i] && mark.status !== 'excused');
    if (!day.length) continue;
    const attended = day.every(mark => mark.status === 'present' || mark.status === 'late');
    if (!attended) break;
    streak += 1;
  }
  return streak;
}

export function summariseAttendance(marks: AttendanceMark[], holidays: readonly string[] = []): AttendanceSummary {
  const holiday = new Set(holidays);
  const countedMarks = marks.filter(mark => !holiday.has(mark.dateKey) && mark.status !== 'excused');
  const present = countedMarks.filter(mark => mark.status === 'present').length;
  const late = countedMarks.filter(mark => mark.status === 'late').length;
  const absent = countedMarks.filter(mark => mark.status === 'absent').length;
  const rate = attendanceRate(marks, holidays);
  return {
    rate,
    streak: attendanceStreak(marks, holidays),
    chronic: rate != null && rate < CHRONIC_ABSENCE_BELOW,
    present,
    late,
    absent,
    excused: marks.filter(mark => mark.status === 'excused' && !holiday.has(mark.dateKey)).length,
    counted: countedMarks.length,
  };
}

export function meanRate(rates: Array<number | null>): number | null {
  const nums = rates.filter((rate): rate is number => typeof rate === 'number');
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, rate) => sum + rate, 0) / nums.length);
}

export interface AbsenceNote {
  id?: string;
  studentId: string;
  parentId: string;
  dateKey: string;
  reason: string;
  courseId?: string;
  status: 'submitted' | 'accepted';
}

export function absenceNoteReady(note: Pick<AbsenceNote, 'reason' | 'dateKey' | 'studentId'>): boolean {
  return note.studentId.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(note.dateKey) && note.reason.trim().length > 0 && note.reason.trim().length <= 500;
}

/** Parent and student alerts for a fresh absent or late mark. */
export function alertableMarks(marks: AttendanceMark[]): AttendanceMark[] {
  return marks.filter(mark => mark.status === 'absent' || mark.status === 'late');
}

export function flattenSessionRecords(records: {
  courseId?: string;
  dateKey?: string;
  records?: { studentId: string; status: AttendanceStatus; note?: string; source?: 'automatic' | 'manual' }[];
}[]): AttendanceMark[] {
  const marks: AttendanceMark[] = [];
  for (const record of records) {
    const dateKey = record.dateKey ?? '';
    if (!dateKey) continue;
    for (const entry of record.records ?? []) {
      marks.push({
        dateKey,
        studentId: entry.studentId,
        courseId: record.courseId,
        status: entry.status,
        source: entry.source ?? 'manual',
        note: entry.note,
      });
    }
  }
  return marks;
}
