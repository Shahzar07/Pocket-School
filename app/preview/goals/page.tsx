'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AddGoalDialog } from '@/components/goals/add-goal-dialog';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { suggestGoalsFromSignals } from '@/lib/insights/goals';
import { isoDateKey, addDays } from '@/lib/insights/dates';

const courses = [{
  id: 'fractions',
  title: 'Fractions',
  teacherId: 'teacher-ada',
  units: [{
    id: 'unit-2',
    title: 'Unit 2 · Equivalent fractions',
    lessons: [
      { id: 'lesson-3', title: 'Lesson 3 · Simplify' },
      { id: 'lesson-4', title: 'Lesson 4 · Compare' },
    ],
  }],
}];

const todayKey = isoDateKey();
const studentGoals: WorkspaceGoal[] = [
  {
    id: 'today',
    dateKey: todayKey,
    title: 'Finish the fractions unit',
    category: 'study',
    estimateMinutes: 25,
    deadline: '09:00',
    status: 'in_progress',
    targetKind: 'lessons',
    lessonIds: ['lesson-3', 'lesson-4'],
    courseLabel: 'Fractions',
    unitTitle: 'Unit 2',
    priority: 'high',
    progress: 50,
    focusMinutes: 25,
    reminderTime: '16:00',
    reward: 'Choose the film',
    checklist: [{ id: 'c1', label: 'Lesson 3', done: true }, { id: 'c2', label: 'Quiz', done: false }],
    reflectionPrompt: 'Which fraction still feels shaky?',
    pomodoroWork: 25,
    pomodoroBreak: 5,
  },
  {
    id: 'yesterday',
    dateKey: addDays(todayKey, -1),
    title: 'Quiz score 80% on decimals',
    category: 'practice',
    estimateMinutes: 20,
    deadline: '18:00',
    status: 'completed',
    targetKind: 'quiz_score',
    quizTarget: 80,
    quizScore: 86,
    progress: 100,
    focusMinutes: 20,
    reactions: [{ parentId: 'parent', emoji: '👏', at: '2026-10-14T18:00:00.000Z' }],
  },
];

const signals = suggestGoalsFromSignals({
  weakTopics: [{ topic: 'equivalent fractions', scorePercent: 55 }],
  examDates: [{ title: 'Unit 2 check', dateKey: '2026-10-22' }],
});

function GoalsPreviewBody() {
  const params = useSearchParams();
  const side = params.get('side') === 'parent' ? 'parent' : 'student';
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6" data-goals-preview={side}>
      <div className="rounded-2xl border border-[var(--ps-cyan-border)] bg-[var(--ps-cyan-soft)] px-4 py-3 text-sm text-[var(--ps-cyan-text)]">
        Sample data for review. This is not a live student record.
      </div>
      <GoalsWorkspace
        viewer={side}
        childName={side === 'parent' ? 'Harry' : undefined}
        goals={studentGoals}
        signalSuggestions={side === 'student' ? signals : []}
        suggestions={side === 'student' ? [{ id: 's1', title: 'Read 10 pages of the workbook', status: 'pending' }] : []}
        onAdd={() => setCreateOpen(true)}
        onToggle={() => undefined}
        onReflect={() => undefined}
        onComplete={() => undefined}
        onLogFocus={() => undefined}
        onCosign={() => undefined}
        onCosignWeek={() => undefined}
        onCheer={() => undefined}
        onAcceptSuggestion={() => undefined}
      />
      <AddGoalDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={async () => undefined} courses={courses} />
    </main>
  );
}

export default function GoalsPreviewPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading goals preview…</main>}>
      <GoalsPreviewBody />
    </Suspense>
  );
}
