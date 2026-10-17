/**
 * One Poket School account follows the learner.
 * Joining another academy keeps the student number and the earlier history.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface EducationSpan {
  institutionId: string;
  institutionName: string;
  level: string;
  from: string;
  to: string;
  studentNumber: string;
}

export function keepStudentNumber(existing: string, incoming = ''): string {
  const kept = existing.trim().toUpperCase();
  if (kept) return kept;
  return incoming.trim().toUpperCase();
}

/** Closes any other open academy and keeps every earlier span. */
export function openEducation(
  history: readonly EducationSpan[],
  next: { institutionId: string; institutionName: string; level: string; studentNumber: string },
  today: string,
): EducationSpan[] {
  const studentNumber = keepStudentNumber(
    history.find((span) => span.studentNumber)?.studentNumber ?? '',
    next.studentNumber,
  );
  const closed = history.map((span) => {
    if (span.institutionId === next.institutionId || span.to) return { ...span, studentNumber };
    return { ...span, to: DATE.test(today) ? today : span.to, studentNumber };
  });
  const prior = closed.find((span) => span.institutionId === next.institutionId);
  const opened: EducationSpan = {
    institutionId: next.institutionId,
    institutionName: next.institutionName.trim() || 'Academy',
    level: next.level.trim(),
    from: prior?.from && DATE.test(prior.from) ? prior.from : today,
    to: '',
    studentNumber,
  };
  return [...closed.filter((span) => span.institutionId !== next.institutionId), opened];
}

export function closeEducation(history: readonly EducationSpan[], institutionId: string, today: string): EducationSpan[] {
  return history.map((span) => (
    span.institutionId === institutionId && !span.to
      ? { ...span, to: DATE.test(today) ? today : span.to }
      : span
  ));
}

export function spanDates(span: Pick<EducationSpan, 'from' | 'to'>): string {
  if (!span.from) return '';
  return span.to ? `${span.from} – ${span.to}` : `${span.from} – present`;
}

/** Records a finished academy without closing a different open one. */
export function rememberClosed(
  history: readonly EducationSpan[],
  span: { institutionId: string; institutionName: string; level: string; studentNumber: string },
  today: string,
): EducationSpan[] {
  const studentNumber = keepStudentNumber(
    history.find((row) => row.studentNumber)?.studentNumber ?? '',
    span.studentNumber,
  );
  const dated = DATE.test(today) ? today : '';
  const existing = history.find((row) => row.institutionId === span.institutionId);
  if (!existing) {
    return [...history.map((row) => ({ ...row, studentNumber })), {
      institutionId: span.institutionId,
      institutionName: span.institutionName.trim() || 'Academy',
      level: span.level.trim(),
      from: dated,
      to: dated,
      studentNumber,
    }];
  }
  return closeEducation(history.map((row) => ({ ...row, studentNumber })), span.institutionId, today);
}
