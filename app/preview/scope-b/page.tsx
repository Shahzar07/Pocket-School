'use client';

import { AnalyticsBoard, BehaviourBoard, GlossaryList } from '@/components/insights/boards';
import { GoalsWorkspace } from '@/components/goals/goals-workspace';
import { buildSnapshot } from '@/lib/insights/aggregate';
import { CALENDAR_TEMPLATES } from '@/lib/insights/calendar';
import { buildIntegrityCase } from '@/lib/insights/integrity';
import { gradeOnScale, scaleById } from '@/lib/insights/report-cards';

const snapshot = buildSnapshot({
  scope: 'student',
  scopeId: 'preview',
  computedAt: '2026-10-15T08:00:00.000Z',
  rangeStart: '2026-10-01',
  rangeEnd: '2026-10-15',
  studyEvents: [
    { minutes: 40, weekday: 1, hour: 16, source: 'focus' },
    { minutes: 25, weekday: 3, hour: 19, source: 'lesson' },
  ],
  quizzes: [
    { at: '2026-10-02T00:00:00.000Z', score: 8, max: 10, topic: 'fractions', correct: true, bloom: 'apply' },
    { at: '2026-10-10T00:00:00.000Z', score: 6, max: 10, topic: 'fractions', correct: false, bloom: 'analyse' },
  ],
  goals: [
    { dateKey: '2026-10-14', title: 'Finish unit 2', status: 'completed', deadline: '18:00' },
    { dateKey: '2026-10-13', title: 'Review notes', status: 'overdue' },
  ],
  attendance: [
    { dateKey: '2026-10-13', status: 'present', studentId: 'preview', source: 'manual' },
    { dateKey: '2026-10-14', status: 'absent', studentId: 'preview', source: 'automatic' },
  ],
  holidays: ['2026-10-12'],
  focusSessions: [{ plannedMinutes: 25, actualMinutes: 25 }],
  hints: 1,
  questions: 4,
  aiTurns: 2,
  sparksEarned: 15,
  deadlinesMs: [],
  cohortScores: [40, 50, 55, 60, 62, 70, 75, 80],
  previousStudyMinutes: 90,
  integrityOpen: false,
  streakBroken: false,
  now: new Date('2026-10-15T08:00:00.000Z'),
});

const integrity = buildIntegrityCase({
  assignmentTitle: 'Fractions essay',
  signals: { pasteEvents: 1, similarity: 42, aiLikelihood: 20 },
});

const igcse = gradeOnScale(86, scaleById('igcse_9_1'));

export default function ScopePreviewPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[var(--ps-cyan-text)]">
        Sample data for review. This is not live school data.
      </div>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Poket School</p>
        <h1 className="font-heading text-4xl">Goals, insights, and reports</h1>
      </header>
      <GoalsWorkspace
        viewer="student"
        goals={[{
          id: 'g1',
          dateKey: '2026-10-15',
          title: 'Finish the fractions unit',
          category: 'study',
          estimateMinutes: 25,
          deadline: '18:00',
          status: 'in_progress',
          checklist: [{ id: 'c1', label: 'Lesson 3', done: true }, { id: 'c2', label: 'Quiz', done: false }],
          progress: 50,
        }]}
        onAdd={() => undefined}
        onToggle={() => undefined}
        onReflect={() => undefined}
        onComplete={() => undefined}
        onLogFocus={() => undefined}
      />
      <AnalyticsBoard snapshot={snapshot} live />
      <BehaviourBoard snapshot={snapshot} />
      <section className="rounded-2xl border border-border p-4 space-y-2">
        <h2 className="font-heading text-2xl">Report card and integrity</h2>
        <p className="text-sm">IGCSE template grade for 86% is {igcse}. A school can replace the bands.</p>
        <p className="text-sm">{integrity.studentSummary}</p>
        <p className="text-sm text-muted-foreground">{integrity.recommendation}</p>
        <p className="text-sm">Malaysia 2026 template starts with {CALENDAR_TEMPLATES[0]?.items.length ?? 0} dates, including dates marked confirm.</p>
      </section>
      <GlossaryList />
    </main>
  );
}
