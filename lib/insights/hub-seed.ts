/**
 * Fixed records for the reports preview and the number checks.
 * Change a figure here and the test fails until the screen matches.
 */

import { automaticMark, mergeMarks, type AttendanceMark } from './attendance';
import { buildReportHub, type HubFilters, type ReportHub, type ReportRole } from './hub';
import { gradeOnScale, scaleById } from './report-cards';

export const SEED_FILTERS: HubFilters = {
  rangeStart: '2026-10-01',
  rangeEnd: '2026-10-15',
  courseId: '',
  classId: 'class-a',
  studentId: 'mina',
  institutionId: 'school-a',
  bloom: '',
};

const manual: AttendanceMark[] = [
  { dateKey: '2026-10-01', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
  { dateKey: '2026-10-03', studentId: 'mina', courseId: 'fractions', status: 'late', source: 'manual', note: 'Arrived after the starter' },
  { dateKey: '2026-10-06', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
  { dateKey: '2026-10-07', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
  { dateKey: '2026-10-08', studentId: 'mina', courseId: 'fractions', status: 'absent', source: 'manual' },
  { dateKey: '2026-10-09', studentId: 'mina', courseId: 'fractions', status: 'absent', source: 'manual', note: 'Flu' },
  { dateKey: '2026-10-10', studentId: 'mina', courseId: 'fractions', status: 'excused', source: 'manual', note: 'Parent note accepted' },
  { dateKey: '2026-10-13', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
  { dateKey: '2026-10-14', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
  { dateKey: '2026-10-15', studentId: 'mina', courseId: 'fractions', status: 'present', source: 'manual' },
];

const fromLogin = automaticMark({
  dateKey: '2026-10-02',
  studentId: 'mina',
  courseId: 'fractions',
  holiday: false,
  loggedIn: true,
  joinedLive: false,
  scheduledSession: true,
  openedLesson: false,
  submittedWork: false,
});

export const SEED_MARKS = mergeMarks(fromLogin ? [fromLogin] : [], manual).map(mark => ({
  ...mark,
  classId: 'class-a',
  institutionId: 'school-a',
}));

export const SEED_PREVIOUS: AttendanceMark[] = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map(dateKey => ({
  dateKey,
  studentId: 'mina',
  courseId: 'fractions',
  status: 'present' as const,
  source: 'manual' as const,
  classId: 'class-a',
  institutionId: 'school-a',
}));

export function seedHub(role: ReportRole, filters: Partial<HubFilters> = {}): ReportHub {
  const next = { ...SEED_FILTERS, ...filters };
  if (role === 'teacher' || role === 'admin' || role === 'institution_admin') {
    next.studentId = filters.studentId ?? '';
  }
  return buildReportHub({
    role,
    scopeLabel: role === 'parent' ? 'Mina' : role === 'institution_admin' ? 'School A' : 'Fractions',
    computedAt: '2026-10-15T18:00:00.000Z',
    filters: next,
    holidays: ['2026-10-05'],
    marks: SEED_MARKS,
    previousMarks: SEED_PREVIOUS,
    classRates: [80, 100],
    institutionRates: [90],
    quizzes: [
      { at: '2026-10-01T09:00:00.000Z', score: 8, max: 10, topic: 'Fractions', bloom: 'remember', unitId: 'u1', courseId: 'fractions', lessonId: 'lesson-1' },
      { at: '2026-10-08T10:15:00.000Z', score: 6, max: 10, topic: 'Fractions', bloom: 'apply', unitId: 'u1', courseId: 'fractions', lessonId: 'lesson-4', correct: false },
    ],
    goals: [
      { id: 'g1', dateKey: '2026-10-14', title: 'Finish lesson 4', status: 'completed', completedLessonIds: ['lesson-4'] },
      { id: 'g2', dateKey: '2026-10-13', title: 'Quiz practice', status: 'completed' },
      { id: 'g3', dateKey: '2026-10-12', title: 'Missed revision', status: 'overdue' },
    ],
    studyEvents: [
      { minutes: 40, at: '2026-10-06T18:00:00.000Z', weekday: 2, hour: 18, courseId: 'fractions' },
      { minutes: 20, at: '2026-10-14T16:00:00.000Z', weekday: 3, hour: 16, courseId: 'fractions' },
    ],
    focusSessions: [{ plannedMinutes: 25, actualMinutes: 25 }],
    certificates: [{ id: 'cert-1', title: 'Fractions', at: '2026-10-14T12:00:00.000Z' }],
    enrolments: [
      { id: 'en-1', courseTitle: 'Fractions', amount: 79, at: '2026-10-01T08:00:00.000Z', studentLabel: 'Learner A' },
      { id: 'en-2', courseTitle: 'Fractions', amount: 79, at: '2026-10-03T08:00:00.000Z', studentLabel: 'Learner B' },
    ],
    notes: [{ id: 'note-1', studentId: 'mina', parentId: 'parent-1', dateKey: '2026-10-09', reason: 'Flu', courseId: 'fractions', status: 'submitted' }],
    cohortScores: [40, 50, 55, 60, 65, 70, 75, 90],
    hints: 1,
    questions: 4,
    aiTurns: 2,
    sparksEarned: 15,
    sparksSpent: 5,
    courseProgress: [{ label: 'Fractions', progress: 80 }],
    storedAttendance: 80,
    reportCard: {
      studentName: 'Mina',
      courseTitle: 'Fractions',
      grade: gradeOnScale(70, scaleById('letter')),
      comment: 'Mina explains fractions clearly and should practise the apply questions she missed on 8 October.',
      termId: 't4',
      year: 2026,
      heading: 'Term report',
    },
    now: new Date(2026, 9, 15),
  });
}

export interface NumberCheck {
  label: string;
  actual: number | string | null;
  expected: number | string;
}

export function seedChecks(hub: ReportHub, bloom: HubFilters['bloom']): NumberCheck[] {
  const quiz = hub.snapshot.metrics.quiz_average;
  const mastery = hub.snapshot.metrics.mastery;
  const checks: NumberCheck[] = [
    { label: 'Attendance', actual: hub.attendance.rate, expected: 80 },
    { label: 'Streak', actual: hub.attendance.streak, expected: 3 },
    { label: 'Chronic', actual: hub.attendance.chronic ? 'yes' : 'no', expected: 'yes' },
    { label: 'Class', actual: hub.classRate, expected: 90 },
    { label: 'Institution', actual: hub.institutionRate, expected: 90 },
    { label: 'Quiz average', actual: quiz, expected: bloom === 'apply' ? 60 : 70 },
    { label: 'Mastery', actual: mastery, expected: 60 },
    { label: 'Goals met', actual: hub.snapshot.metrics.goal_completion, expected: 67 },
    { label: 'Study minutes', actual: hub.snapshot.metrics.study_time, expected: 60 },
    { label: 'Certificates', actual: hub.sections.find(section => section.id === 'certificates')?.kpis[0]?.value ?? null, expected: 1 },
    { label: 'Previous attendance', actual: hub.previous.previous, expected: 100 },
    { label: 'Attendance change', actual: hub.previous.diff, expected: -20 },
    { label: 'Reconciled', actual: hub.reconciliation.match ? 'yes' : 'no', expected: 'yes' },
    { label: 'Cohort size', actual: hub.cohort?.size ?? null, expected: 8 },
    { label: 'Cohort percentile', actual: hub.cohort?.percentile ?? null, expected: 38 },
  ];
  if (hub.role === 'teacher' || hub.role === 'admin' || hub.role === 'institution_admin') {
    checks.push(
      { label: 'Enrolments', actual: hub.sections.find(section => section.id === 'revenue')?.kpis.find(kpi => kpi.metricId === 'enrolment_count')?.value ?? null, expected: 2 },
      { label: 'Revenue', actual: hub.sections.find(section => section.id === 'revenue')?.kpis.find(kpi => kpi.metricId === 'revenue')?.value ?? null, expected: 158 },
    );
  }
  return checks;
}
