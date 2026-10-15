export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceMark {
  dateKey: string;
  status: AttendanceStatus;
  studentId: string;
  courseId?: string;
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
