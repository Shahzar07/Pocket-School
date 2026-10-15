/**
 * A term report card assembled from the same metrics as Reports.
 * An integrity note appears only after a teacher confirms a case.
 */

import { gradeOnScale, normaliseTemplate, scaleById, type Acknowledgement, type SchoolTemplate } from './report-cards';
import { recordVerdict } from './reexam';

export interface SubjectLine {
  courseId: string;
  courseTitle: string;
  percent: number;
  grade: string;
  bloomMastery: number | null;
  attendanceRate: number | null;
  behaviour: string;
  effort: number | null;
  goalsAchieved: number;
  goalsSet: number;
  teacherId: string;
  teacherName: string;
  signedOff: boolean;
  comment: string;
  commentDraft: string;
}

export interface TermPoint {
  courseId: string;
  courseTitle: string;
  percent: number;
}

export interface TermDelta {
  courseId: string;
  courseTitle: string;
  current: number;
  previous: number | null;
  delta: number | null;
}

export function suggestComment(input: {
  name: string;
  course: string;
  percent: number;
  bloom: number | null;
  attendance: number | null;
  goalsAchieved: number;
  goalsSet: number;
  effort: number | null;
}): string {
  const bloom = input.bloom == null ? 'Bloom mastery is not on this card yet' : `Bloom mastery is ${input.bloom}`;
  const attendance = input.attendance == null ? 'attendance is not on this card yet' : `attendance is ${input.attendance}%`;
  const effort = input.effort == null ? 'effort check-ins are not recorded' : `effort check-ins average ${input.effort}`;
  return `${input.name} is working at ${input.percent}% in ${input.course}. ${bloom}. ${attendance.charAt(0).toUpperCase()}${attendance.slice(1)}. Goals completed: ${input.goalsAchieved} of ${input.goalsSet}. ${effort.charAt(0).toUpperCase()}${effort.slice(1)}. Please edit this draft before it is published.`;
}

export function subjectLine(input: Omit<SubjectLine, 'grade' | 'commentDraft' | 'signedOff' | 'comment'> & {
  scaleId: string;
  studentName?: string;
  comment?: string;
  signedOff?: boolean;
}): SubjectLine {
  const grade = gradeOnScale(input.percent, scaleById(input.scaleId));
  const commentDraft = suggestComment({
    name: input.studentName ?? 'This student',
    course: input.courseTitle,
    percent: input.percent,
    bloom: input.bloomMastery,
    attendance: input.attendanceRate,
    goalsAchieved: input.goalsAchieved,
    goalsSet: input.goalsSet,
    effort: input.effort,
  });
  return {
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    percent: input.percent,
    grade,
    bloomMastery: input.bloomMastery,
    attendanceRate: input.attendanceRate,
    behaviour: input.behaviour,
    effort: input.effort,
    goalsAchieved: input.goalsAchieved,
    goalsSet: input.goalsSet,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    signedOff: input.signedOff ?? false,
    comment: input.comment ?? '',
    commentDraft,
  };
}

/** Only a confirmed case is allowed onto a report card. Open, dismissed, and upheld appeals stay off it. */
export function integrityNoteFor(decisions: string[]): string | null {
  if (!decisions.includes('confirmed')) return null;
  return recordVerdict('confirm').integrityNote;
}

export function compareTerms(current: TermPoint[], previous: TermPoint[]): TermDelta[] {
  return current.map(row => {
    const prior = previous.find(item => item.courseId === row.courseId);
    return {
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      current: row.percent,
      previous: prior ? prior.percent : null,
      delta: prior ? row.percent - prior.percent : null,
    };
  });
}

export function signOff(line: SubjectLine, teacherId: string): SubjectLine {
  if (line.teacherId !== teacherId) return line;
  return { ...line, signedOff: true };
}

export function parentSign(input: { parentId: string; parentName: string; reply: string; at: string }): Acknowledgement & { reply: string; signatureName: string } {
  return {
    status: 'acknowledged',
    parentId: input.parentId,
    parentName: input.parentName,
    at: input.at,
    note: input.reply,
    reply: input.reply,
    signatureName: input.parentName,
  };
}

export interface ReportCardModel {
  studentId: string;
  studentName: string;
  termId: string;
  year: number;
  template: SchoolTemplate;
  subjects: SubjectLine[];
  integrityNote: string | null;
  comparison: TermDelta[];
  acknowledgement: Acknowledgement;
  automaticPenalty: false;
}

export function assembleCard(input: {
  studentId: string;
  studentName: string;
  termId: string;
  year: number;
  template: SchoolTemplate;
  subjects: SubjectLine[];
  decisions: string[];
  previous?: TermPoint[];
}): ReportCardModel {
  const template = normaliseTemplate(input.template);
  return {
    studentId: input.studentId,
    studentName: input.studentName,
    termId: input.termId,
    year: input.year,
    template,
    subjects: input.subjects,
    integrityNote: integrityNoteFor(input.decisions),
    comparison: compareTerms(
      input.subjects.map(row => ({ courseId: row.courseId, courseTitle: row.courseTitle, percent: row.percent })),
      input.previous ?? [],
    ),
    acknowledgement: { status: 'pending' },
    automaticPenalty: false,
  };
}

export function cardPdfLines(card: ReportCardModel, verifyUrl: string): string[] {
  const lines = [
    card.template.heading,
    `${card.studentName} · ${card.termId} ${card.year}`,
    card.template.logoUrl ? `Logo: ${card.template.logoUrl}` : 'Logo: school template',
    `Scale: ${card.template.scaleId}`,
  ];
  for (const subject of card.subjects) {
    lines.push(`${subject.courseTitle}: ${subject.grade} (${subject.percent}%)`);
    lines.push(`Bloom ${subject.bloomMastery ?? '—'} · attendance ${subject.attendanceRate ?? '—'}% · ${subject.behaviour} · effort ${subject.effort ?? '—'} · goals ${subject.goalsAchieved}/${subject.goalsSet}`);
    lines.push(subject.signedOff ? `Signed off by ${subject.teacherName}` : `${subject.teacherName} has not signed off yet`);
    if (subject.comment) lines.push(subject.comment);
  }
  for (const row of card.comparison) {
    if (row.delta == null) continue;
    const direction = row.delta > 0 ? `up ${row.delta}` : row.delta < 0 ? `down ${Math.abs(row.delta)}` : 'unchanged';
    lines.push(`${row.courseTitle} versus last term: ${direction} points.`);
  }
  if (card.integrityNote) lines.push(card.integrityNote);
  lines.push(`Verify: ${verifyUrl}`);
  return lines;
}

export function bulkCardIds(studentIds: string[], courseId: string, termId: string, year: number): string[] {
  return studentIds.map(id => `${id}_${courseId}_${termId}_${year}`);
}
