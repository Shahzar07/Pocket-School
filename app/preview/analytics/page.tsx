'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExportBar, snapshotKpis } from '@/components/insights/boards';
import { ClassCharts, LearningCharts } from '@/components/insights/learning-charts';
import { buildSnapshot } from '@/lib/insights/aggregate';

function sampleSnapshot() {
  return buildSnapshot({
    scope: 'student',
    scopeId: 'sample-student',
    computedAt: '2026-10-15T18:00:00.000Z',
    rangeStart: '2026-10-01',
    rangeEnd: '2026-10-15',
    studyEvents: [
      { minutes: 25, weekday: 1, hour: 16, at: '2026-10-05T16:00:00.000Z' },
      { minutes: 40, weekday: 2, hour: 18, at: '2026-10-06T18:00:00.000Z' },
      { minutes: 15, weekday: 3, hour: 18, at: '2026-10-07T18:00:00.000Z' },
      { minutes: 35, weekday: 4, hour: 19, at: '2026-10-08T19:00:00.000Z' },
      { minutes: 50, weekday: 5, hour: 16, at: '2026-10-09T16:00:00.000Z' },
      { minutes: 10, weekday: 1, hour: 16, at: '2026-10-12T16:00:00.000Z' },
      { minutes: 30, weekday: 3, hour: 18, at: '2026-10-14T18:00:00.000Z' },
    ],
    quizzes: [
      { at: '2026-10-06', score: 9, max: 10, topic: 'Fractions', bloom: 'remember', attempts: 1, seconds: 40, correct: true },
      { at: '2026-10-08', score: 7, max: 10, topic: 'Fractions', bloom: 'apply', attempts: 2, seconds: 70, correct: true },
      { at: '2026-10-10', score: 4, max: 10, topic: 'Decimals', bloom: 'analyse', prompt: 'Compare 0.5 and 1/2', attempts: 3, seconds: 110, correct: false },
      { at: '2026-10-14', score: 8, max: 10, topic: 'Decimals', bloom: 'evaluate', attempts: 1, seconds: 55, correct: true },
    ],
    goals: [
      { dateKey: '2026-10-14', title: 'Fractions lesson', status: 'completed', estimateMinutes: 25, completedLessonIds: ['l1', 'l2'] },
      { dateKey: '2026-10-13', title: 'Decimals quiz', status: 'completed', estimateMinutes: 20, completedLessonIds: ['l3'] },
      { dateKey: '2026-10-12', title: 'Missed revision', status: 'overdue', estimateMinutes: 15 },
    ],
    attendance: [{ dateKey: '2026-10-14', status: 'present', studentId: 'sample-student', source: 'manual' }],
    holidays: [],
    focusSessions: [{ plannedMinutes: 25, actualMinutes: 25 }, { plannedMinutes: 25, actualMinutes: 20 }],
    hints: 2,
    questions: 8,
    aiTurns: 3,
    sparksEarned: 120,
    sparksSpent: 45,
    courseProgress: [
      { label: 'Fractions', progress: 80 },
      { label: 'Decimals', progress: 35 },
    ],
    deadlinesMs: [new Date('2026-10-09T18:00:00.000Z').getTime()],
    cohortScores: [40, 48, 55, 60, 66, 72, 78, 84],
    previousStudyMinutes: 90,
    integrityOpen: false,
    streakBroken: false,
    now: new Date(2026, 9, 15),
  });
}

const CLASS_ROWS = [
  { title: 'Fractions', progress: 74, quiz: 81, students: 18 },
  { title: 'Decimals', progress: 46, quiz: 63, students: 18 },
  { title: 'Algebra', progress: 28, quiz: 55, students: 12 },
];

function AnalyticsPreviewBody() {
  const params = useSearchParams();
  const side = params.get('side') === 'teacher' ? 'teacher' : params.get('side') === 'parent' ? 'parent' : 'student';
  const snapshot = useMemo(() => sampleSnapshot(), []);
  const [made, setMade] = useState<string | null>(null);
  const label = side === 'teacher' ? 'Teacher class view' : side === 'parent' ? 'Parent per-child view' : 'Student dashboard';

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6" data-analytics-preview={side}>
      <div className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[var(--ps-cyan-text)]">
        Sample data for review. This is not a live student record. {label}.
      </div>
      <h1 className="font-heading text-3xl">{label}</h1>
      {made && <p className="text-sm" data-made-goal>Next action saved as a goal: {made}</p>}
      {side === 'teacher' ? (
        <>
          <ClassCharts rows={CLASS_ROWS} />
          <ExportBar kpis={CLASS_ROWS.map(row => ({
            metricId: 'mastery',
            value: row.progress,
            records: [{ id: row.title, label: row.title, when: 'class', value: `${row.progress}% progress, quiz ${row.quiz}%` }],
          }))} />
        </>
      ) : (
        <>
          <ExportBar kpis={snapshotKpis(snapshot)} />
          <LearningCharts
            snapshot={snapshot}
            onMakeGoal={(title) => setMade(title)}
          />
        </>
      )}
    </main>
  );
}

export default function AnalyticsPreviewPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading analytics preview…</main>}>
      <AnalyticsPreviewBody />
    </Suspense>
  );
}
