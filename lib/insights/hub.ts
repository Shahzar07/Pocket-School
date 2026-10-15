/**
 * One report for every role. The numbers come from the same snapshot definitions
 * as the analytics charts. Each figure keeps the records that produced it.
 */

import {
  bloomByTopic, type BloomLevel, type QuizPoint, type StudyEvent,
} from './analytics';
import { buildSnapshot, type AnalyticsSnapshot } from './aggregate';
import {
  alertableMarks, meanRate, summariseAttendance, type AbsenceNote, type AttendanceMark, type AttendanceSummary,
} from './attendance';
import type { GoalLike } from './goals';
import type { FocusSessionLike } from './behaviour';
import { delta, type DrillRecord, type Kpi } from './reports';

export type ReportRole = 'student' | 'parent' | 'teacher' | 'institution_admin' | 'admin';

export interface CertificateRow {
  id: string;
  title: string;
  at: string;
}

export interface EnrolmentRow {
  id: string;
  courseTitle: string;
  amount: number;
  at: string;
  studentLabel: string;
}

export interface HubFilters {
  rangeStart: string;
  rangeEnd: string;
  courseId: string;
  classId: string;
  studentId: string;
  institutionId: string;
  bloom: BloomLevel | '';
}

export interface ReportCardView {
  studentName: string;
  courseTitle: string;
  grade: string;
  comment: string;
  termId: string;
  year: number;
  heading: string;
}

export interface ReportHub {
  role: ReportRole;
  scopeLabel: string;
  computedAt: string;
  filters: HubFilters;
  sections: { id: string; title: string; kpis: Kpi[] }[];
  attendance: AttendanceSummary;
  classRate: number | null;
  institutionRate: number | null;
  alerts: AttendanceMark[];
  notes: AbsenceNote[];
  reconciliation: { metricId: string; stored: number | null; raw: number | null; match: boolean };
  previous: { metricId: string; current: number | null; previous: number | null; diff: number | null; direction: string };
  cohort: { percentile: number; size: number } | null;
  reportCard: ReportCardView | null;
  snapshot: AnalyticsSnapshot;
}

export interface HubInput {
  role: ReportRole;
  scopeLabel: string;
  computedAt: string;
  filters: HubFilters;
  holidays: string[];
  marks: AttendanceMark[];
  previousMarks: AttendanceMark[];
  classRates: Array<number | null>;
  institutionRates: Array<number | null>;
  quizzes: QuizPoint[];
  goals: GoalLike[];
  studyEvents: StudyEvent[];
  focusSessions: FocusSessionLike[];
  certificates: CertificateRow[];
  enrolments: EnrolmentRow[];
  notes: AbsenceNote[];
  cohortScores: number[];
  hints: number;
  questions: number;
  aiTurns: number;
  sparksEarned: number;
  sparksSpent?: number;
  courseProgress?: { label: string; progress: number }[];
  storedAttendance?: number | null;
  reportCard?: ReportCardView | null;
  now: Date;
}

const STAFF = new Set<ReportRole>(['teacher', 'institution_admin', 'admin']);

function snapshotKpis(snapshot: AnalyticsSnapshot): Kpi[] {
  return Object.entries(snapshot.metrics).map(([metricId, value]) => ({ metricId, value, records: [] }));
}

function inRange(day: string, filters: HubFilters): boolean {
  return day >= filters.rangeStart && day <= filters.rangeEnd;
}

function scopedMarks(marks: AttendanceMark[], filters: HubFilters): AttendanceMark[] {
  return marks.filter(mark => {
    if (!inRange(mark.dateKey, filters)) return false;
    if (filters.courseId && mark.courseId && mark.courseId !== filters.courseId) return false;
    if (filters.classId && mark.classId && mark.classId !== filters.classId) return false;
    if (filters.institutionId && mark.institutionId && mark.institutionId !== filters.institutionId) return false;
    if (filters.studentId && mark.studentId !== filters.studentId) return false;
    return true;
  });
}

function scopedQuizzes(quizzes: QuizPoint[], filters: HubFilters): QuizPoint[] {
  return quizzes.filter(quiz => {
    const day = quiz.at.slice(0, 10);
    if (!inRange(day, filters)) return false;
    if (filters.courseId && quiz.courseId && quiz.courseId !== filters.courseId) return false;
    if (filters.bloom && quiz.bloom !== filters.bloom) return false;
    return true;
  });
}

function record(id: string, when: string, label: string, value: string): DrillRecord {
  return { id, when, label, value };
}

function recordsFor(metricId: string, input: HubInput, marks: AttendanceMark[], quizzes: QuizPoint[]): DrillRecord[] {
  if (metricId === 'attendance_rate') {
    return marks.map(mark => record(`${mark.studentId}-${mark.dateKey}-${mark.courseId ?? ''}`, mark.dateKey, mark.status, `${mark.source}${mark.note ? ` · ${mark.note}` : ''}`));
  }
  if (metricId === 'quiz_average' || metricId === 'mastery' || metricId === 'understanding') {
    return quizzes.map((quiz, index) => record(quiz.lessonId ?? `${quiz.at}-${index}`, quiz.at, quiz.topic || quiz.unitId || 'Quiz', `${quiz.score}/${quiz.max}${quiz.bloom ? ` · ${quiz.bloom}` : ''}`));
  }
  if (metricId === 'study_time' || metricId === 'pace' || metricId === 'seconds_per_question') {
    return input.studyEvents.filter(event => event.at && inRange(event.at.slice(0, 10), input.filters)).map((event, index) => record(`study-${index}`, event.at ?? '', event.courseId || 'Study', `${event.minutes} min`));
  }
  if (metricId === 'goal_completion' || metricId === 'streak' || metricId === 'lessons_completed') {
    return input.goals.filter(goal => inRange(goal.dateKey, input.filters)).map(goal => record(goal.id ?? goal.dateKey + goal.title, goal.dateKey, goal.title, goal.status));
  }
  if (metricId === 'certificate_count') {
    return input.certificates.filter(cert => inRange(cert.at.slice(0, 10), input.filters)).map(cert => record(cert.id, cert.at, cert.title, 'Issued'));
  }
  if (metricId === 'enrolment_count' || metricId === 'revenue') {
    return input.enrolments.filter(row => inRange(row.at.slice(0, 10), input.filters)).map(row => record(row.id, row.at, row.courseTitle, `${row.studentLabel} · ${row.amount}`));
  }
  if (metricId === 'focus_adherence') {
    return input.focusSessions.map((session, index) => record(`focus-${index}`, input.filters.rangeEnd, 'Focus session', `${session.actualMinutes}/${session.plannedMinutes} min`));
  }
  return [];
}

function section(id: string, title: string, ids: string[], kpis: Kpi[]): { id: string; title: string; kpis: Kpi[] } {
  const wanted = new Set(ids);
  return { id, title, kpis: kpis.filter(kpi => wanted.has(kpi.metricId)) };
}

export function buildReportHub(input: HubInput): ReportHub {
  const marks = scopedMarks(input.marks, input.filters);
  const quizzes = scopedQuizzes(input.quizzes, input.filters);
  const snapshot = buildSnapshot({
    scope: input.role === 'parent' ? 'parent_child' : input.role === 'student' ? 'student' : 'teacher',
    scopeId: input.filters.studentId || input.scopeLabel,
    computedAt: input.computedAt,
    rangeStart: input.filters.rangeStart,
    rangeEnd: input.filters.rangeEnd,
    studyEvents: input.studyEvents,
    quizzes,
    goals: input.goals.filter(goal => inRange(goal.dateKey, input.filters)),
    attendance: marks,
    holidays: input.holidays,
    focusSessions: input.focusSessions,
    hints: input.hints,
    questions: input.questions,
    aiTurns: input.aiTurns,
    sparksEarned: input.sparksEarned,
    sparksSpent: input.sparksSpent,
    courseProgress: input.courseProgress,
    deadlinesMs: [],
    cohortScores: input.cohortScores,
    previousStudyMinutes: null,
    integrityOpen: false,
    streakBroken: false,
    now: input.now,
  });
  const attendance = summariseAttendance(marks, input.holidays);
  const certificates = input.certificates.filter(cert => inRange(cert.at.slice(0, 10), input.filters));
  const enrolments = input.enrolments.filter(row => inRange(row.at.slice(0, 10), input.filters));
  const extra: Kpi[] = [
    { metricId: 'certificate_count', value: certificates.length, records: [] },
  ];
  if (STAFF.has(input.role)) {
    extra.push(
      { metricId: 'enrolment_count', value: enrolments.length, records: [] },
      { metricId: 'revenue', value: enrolments.reduce((sum, row) => sum + row.amount, 0), records: [] },
    );
  }
  const kpis = [...snapshotKpis(snapshot), ...extra].map(kpi => ({
    ...kpi,
    records: recordsFor(kpi.metricId, input, marks, quizzes),
  }));
  const previous = summariseAttendance(scopedMarks(input.previousMarks, { ...input.filters, rangeStart: '0000-01-01', rangeEnd: '9999-12-31' }), input.holidays);
  const compared = delta(attendance.rate, previous.rate);
  const sections = [
    section('progress', 'Progress', ['mastery', 'lessons_completed', 'confidence_mastery'], kpis),
    section('attendance', 'Attendance', ['attendance_rate'], kpis),
    section('assessments', 'Assessments and grades', ['quiz_average', 'mastery', 'exam_readiness'], kpis),
    section('bloom', 'Bloom’s mastery', ['understanding'], kpis),
    section('behaviour', 'Behaviour and engagement', ['consistency', 'focus_adherence', 'hint_rate', 'ai_usage', 'cramming', 'procrastination'], kpis),
    section('goals', 'Goals', ['goal_completion', 'streak'], kpis),
    section('time', 'Time on task', ['study_time', 'pace'], kpis),
    section('certificates', 'Certificates', ['certificate_count'], kpis),
  ];
  if (STAFF.has(input.role)) {
    sections.push(section('course', 'Course and content', ['mastery', 'quiz_average', 'attendance_rate'], kpis));
    sections.push(section('revenue', 'Revenue and enrolments', ['enrolment_count', 'revenue'], kpis));
  }
  const raw = attendance.rate;
  const stored = input.storedAttendance === undefined ? raw : input.storedAttendance;
  return {
    role: input.role,
    scopeLabel: input.scopeLabel,
    computedAt: input.computedAt,
    filters: input.filters,
    sections,
    attendance,
    classRate: meanRate(input.classRates),
    institutionRate: meanRate(input.institutionRates),
    alerts: alertableMarks(marks),
    notes: input.notes,
    reconciliation: { metricId: 'attendance_rate', stored, raw, match: stored == null || stored === raw },
    previous: { metricId: 'attendance_rate', current: attendance.rate, previous: previous.rate, diff: compared.diff, direction: compared.direction },
    cohort: snapshot.cohort,
    reportCard: input.reportCard ?? null,
    snapshot,
  };
}

export function bloomTopicCount(quizzes: QuizPoint[]): number {
  return bloomByTopic(quizzes).length;
}
