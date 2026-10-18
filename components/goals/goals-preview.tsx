'use client';

import { useState } from 'react';
import { AddGoalDialog } from '@/components/goals/add-goal-dialog';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { ParentPlanCard } from '@/components/goals/parent-plan-card';
import { WeeklyPlan } from '@/components/goals/weekly-plan';
import { isoDateKey } from '@/lib/insights/dates';
import { weekColumns } from '@/lib/study/planner';

const columns = weekColumns([
  { title: 'Continue IGCSE Maths', dateKey: '2026-10-19', estimateMinutes: 45, status: 'completed', actualMinutes: 40, source: 'et_ai' },
  { title: 'Revise algebra', dateKey: '2026-10-20', estimateMinutes: 30, status: 'not_started', source: 'et_ai' },
  { title: 'Homework: worksheet', dateKey: '2026-10-21', estimateMinutes: 30, status: 'not_started', source: 'teacher' },
  { title: 'Reading', dateKey: '2026-10-22', estimateMinutes: 20, status: 'not_started', source: 'self' },
  { title: 'Practice paper', dateKey: '2026-10-23', estimateMinutes: 45, status: 'not_started', source: 'et_ai' },
], '2026-10-18');

const COURSES = [{
  id: 'igcse-maths',
  title: 'IGCSE Maths',
  units: [{ id: 'algebra', title: 'Algebra', lessons: [{ id: 'linear', title: 'Linear equations' }] }],
}];

export function GoalsPreview({ view }: { view: string }) {
  const [open, setOpen] = useState(view === 'modal');
  const today = isoDateKey();
  const goals: WorkspaceGoal[] = [
    { id: 'g1', title: 'Continue IGCSE Maths', dateKey: today, estimateMinutes: 45, deadline: '19:30', status: 'not_started', source: 'et_ai', category: 'study' },
    { id: 'g2', title: 'Revise algebra', dateKey: today, estimateMinutes: 30, status: 'in_progress', source: 'student', category: 'revision', checklist: [{ id: 'c1', label: 'Factorise', done: true }, { id: 'c2', label: 'Solve', done: false }] },
  ];
  if (view === 'parent') {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ParentPlanCard childName="Alex Student" planned={75} actual={40} onTime={1} open={2} missed={0} rate={33} streak={4} />
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl p-6">
      <GoalsWorkspace
        goals={goals}
        viewer="student"
        onAdd={() => setOpen(true)}
        onToggle={() => undefined}
        onReflect={() => undefined}
        onComplete={() => undefined}
        onLogFocus={() => undefined}
      />
      <div className="mt-8">
        <WeeklyPlan columns={columns} />
      </div>
      <AddGoalDialog
        open={open || view === 'modal'}
        courses={COURSES}
        onClose={() => setOpen(false)}
        onCreate={async () => setOpen(false)}
      />
    </main>
  );
}
