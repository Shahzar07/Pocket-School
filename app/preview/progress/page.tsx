'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProgressBoard } from '@/components/progress/progress-board';
import { evaluateProgress, type LearnerFacts, type ProgressAlertView } from '@/lib/alerts/progress';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function base(overrides: Partial<LearnerFacts>): LearnerFacts {
  return {
    studentId: 'student-1',
    studentName: 'Mina',
    level: 'Lower Secondary',
    courseId: 'course-maths',
    courseTitle: 'Mathematics',
    institutionId: 'school-1',
    teacherIds: ['teacher-1'],
    adult: false,
    independent: false,
    now: NOW,
    lastLessonAt: NOW - DAY,
    streakDays: 4,
    previousStreakDays: 3,
    lessonsExpected: 4,
    lessonsCompleted: 4,
    unitAttempts: [],
    priorScores: [80, 78],
    latestScore: 76,
    assignments: [],
    bloom: [],
    sessionMinutes: [20, 22, 18, 21],
    lessonFailures: [],
    projectedFinal: 82,
    safeguardingCaseId: null,
    reviewLessons: [{ lessonId: 'lesson-fractions', title: 'Fractions' }],
    visuals: [{ lessonId: 'lesson-fractions', title: 'Fractions', kind: 'revisionPoster', src: 'https://cdn.example/poster.png' }],
    openSeverity: null,
    ...overrides,
  };
}

function card(id: string, facts: LearnerFacts, status: ProgressAlertView['status'] = 'open'): ProgressAlertView {
  const evaluation = evaluateProgress(facts);
  const severity = evaluation.severity ?? 'low';
  const positive = evaluation.positive;
  return {
    id,
    type: 'progress',
    polarity: evaluation.severity ? 'concern' : 'positive',
    severity,
    status,
    studentId: facts.studentId,
    studentName: facts.studentName,
    adult: facts.adult,
    level: facts.level,
    courseId: facts.courseId,
    courseTitle: facts.courseTitle,
    institutionId: facts.institutionId,
    title: evaluation.severity ? `A plan for ${facts.courseTitle}` : 'Comeback',
    summary: evaluation.signals[0]?.detail || `${facts.studentName} is back on track in ${facts.courseTitle}.`,
    signals: evaluation.signals,
    plan: evaluation.plan,
    safeguardingCaseId: facts.safeguardingCaseId,
    assigneeId: null,
    badge: evaluation.badge,
    positive,
    notes: [],
    audit: [{ at: NOW, action: 'opened', detail: 'Recorded from the course.' }],
    streakDays: facts.streakDays,
    createdAt: NOW - 2 * 60 * 60 * 1000,
    accountability: facts.adult || !evaluation.severity || evaluation.severity === 'low' ? {
      ownerName: 'Ms Rahman',
      coOwnerName: '',
      dueAt: null,
      acknowledgedAt: null,
      actedAt: null,
      parentSeenAt: null,
      parentActedAt: null,
      staffAction: null,
      parentAction: null,
      overdue: false,
      tasks: [{ id: 'student-review', who: 'student', text: `Finish ${facts.reviewLessons[0]?.title ?? 'the next lesson'} when you are ready.`, dueAt: NOW + 7 * 24 * 60 * 60 * 1000, doneAt: null }],
      agenda: '',
      meeting: null,
      teacherStep: 0,
      parentStep: 0,
      recognition: [],
    } : {
      ownerName: 'Ms Rahman',
      coOwnerName: 'Parent',
      dueAt: NOW + (evaluation.severity === 'critical' ? 2 : evaluation.severity === 'high' ? 24 : 48) * 60 * 60 * 1000,
      acknowledgedAt: null,
      actedAt: null,
      parentSeenAt: null,
      parentActedAt: null,
      staffAction: null,
      parentAction: null,
      overdue: false,
      tasks: [
        { id: 'student-review', who: 'student', text: `Finish ${facts.reviewLessons[0]?.title ?? 'the next lesson'} when you are ready.`, dueAt: NOW, doneAt: null },
        { id: 'parent-minutes', who: 'parent', text: `Keep 20 minutes a day for ${facts.reviewLessons[0]?.title ?? 'the next lesson'}.`, dueAt: NOW, doneAt: null },
        { id: 'teacher-review', who: 'teacher', text: `Review ${facts.reviewLessons[0]?.title ?? 'the next lesson'} on Friday.`, dueAt: NOW, doneAt: null },
      ],
      agenda: `${facts.courseTitle} is on record for ${facts.level}.`,
      meeting: { provider: 'meet', url: 'https://meet.google.com/poket-plan', at: NOW, agenda: `${facts.courseTitle} is on record for ${facts.level}.` },
      teacherStep: 0,
      parentStep: 0,
      recognition: [],
    },
    updatedAt: NOW,
    resolvedAt: null,
    autoResolved: false,
  };
}

const STUDENT = card('student', base({
  lastLessonAt: NOW - 3 * DAY,
  unitAttempts: [{ lessonId: 'unit-1', unitTitle: 'Fractions', version: 'A', passed: false, percentage: 48 }],
}));

const PARENT = [
  card('p1', base({ studentName: 'Mina', lastLessonAt: NOW - 3 * DAY })),
  card('p2', base({
    studentId: 'student-2',
    studentName: 'Arun',
    courseTitle: 'Science',
    level: 'IGCSE',
    unitAttempts: [{ lessonId: 'unit-2', unitTitle: 'Cells', version: 'B', passed: false, percentage: 42 }],
    reviewLessons: [{ lessonId: 'lesson-cells', title: 'Cells' }],
    visuals: [],
  })),
  card('p3', base({
    studentId: 'student-3',
    studentName: 'Leila',
    courseTitle: 'English',
    level: 'A-Level',
    openSeverity: 'high',
    lastLessonAt: NOW - DAY,
    streakDays: 2,
    previousStreakDays: 2,
    lessonsExpected: 4,
    lessonsCompleted: 4,
    priorScores: [70],
    latestScore: 84,
  })),
];

const TEACHER = [
  card('t1', base({
    studentName: 'Noah',
    level: 'IGCSE',
    courseTitle: 'Biology',
    projectedFinal: 61,
    priorScores: [70, 68],
    latestScore: 62,
    safeguardingCaseId: 'case-204',
    sessionMinutes: [30, 28, 32, 6],
    reviewLessons: [{ lessonId: 'lesson-genetics', title: 'Genetics' }],
    visuals: [],
  })),
  card('t2', base({
    studentName: 'Mina',
    lastLessonAt: NOW - 14 * DAY,
    lessonsExpected: 8,
    lessonsCompleted: 2,
  })),
  card('t3', base({
    studentName: 'Arun',
    unitAttempts: [{ lessonId: 'unit-2', unitTitle: 'Algebra', version: 'B', passed: false, percentage: 40 }],
    reviewLessons: [{ lessonId: 'lesson-algebra', title: 'Algebra' }],
    visuals: [{ lessonId: 'lesson-algebra', title: 'Algebra', kind: 'mindmapImage', src: 'https://cdn.example/map.png' }],
  })),
  card('t4', base({
    studentName: 'Leila',
    level: 'Primary',
    courseTitle: 'English',
    openSeverity: 'critical',
    projectedFinal: 88,
    lastLessonAt: NOW - DAY,
  }), 'acknowledged'),
].sort((a, b) => {
  const order = ['critical', 'high', 'medium', 'low'];
  return order.indexOf(a.severity) - order.indexOf(b.severity);
});

function Preview() {
  const view = useSearchParams().get('view') ?? 'student';
  if (view === 'parent') {
    return (
      <ProgressBoard
        mode="parent"
        eyebrow="Family"
        title="Child progress"
        description="Each child keeps their own traffic light. Adult learners are not listed here."
        alerts={PARENT}
      />
    );
  }
  if (view === 'teacher') {
    return (
      <ProgressBoard
        mode="teacher"
        eyebrow="Class"
        title="Class risk"
        description="Highest severity first. The plan uses only lessons and scores already on the record."
        alerts={TEACHER}
      />
    );
  }
  return (
    <ProgressBoard
      mode="student"
      eyebrow="ET AI"
      title="My progress"
      description="A short plan from the lessons already on your record."
      alerts={[STUDENT]}
    />
  );
}

export default function ProgressPreviewPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <Suspense fallback={<div className="ps-skeleton min-h-screen" aria-hidden="true" />}>
        <Preview />
      </Suspense>
    </main>
  );
}
