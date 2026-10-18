'use client';

import { DailyGoalsModal } from '@/components/daily-goals-modal';
import { ParentPlanCard } from '@/components/goals/parent-plan-card';
import { WeeklyPlan } from '@/components/goals/weekly-plan';
import { weekColumns } from '@/lib/study/planner';

const columns = weekColumns([
  { title: 'Continue IGCSE Maths', dateKey: '2026-10-19', estimateMinutes: 45, status: 'completed', actualMinutes: 40, source: 'et_ai' },
  { title: 'Revise algebra', dateKey: '2026-10-20', estimateMinutes: 30, status: 'not_started', source: 'et_ai' },
  { title: 'Homework: worksheet', dateKey: '2026-10-21', estimateMinutes: 30, status: 'not_started', source: 'teacher' },
  { title: 'Reading', dateKey: '2026-10-22', estimateMinutes: 20, status: 'not_started', source: 'self' },
  { title: 'Practice paper', dateKey: '2026-10-23', estimateMinutes: 45, status: 'not_started', source: 'et_ai' },
], '2026-10-18');

export function GoalsPreview({ view }: { view: string }) {
  if (view === 'parent') {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ParentPlanCard childName="Alex Student" planned={75} actual={40} onTime={1} open={2} missed={0} rate={33} streak={4} />
      </main>
    );
  }
  if (view === 'modal') {
    return (
      <main className="min-h-screen bg-[#E9F7FA]">
        <DailyGoalsModal
          open
          studentId=""
          studentName="Alex Student"
          streak={4}
          minutesLeft={150}
          suggestions={[{
            key: 'sug-1',
            title: 'Carry over: unfinished algebra',
            category: 'revision',
            estimateMinutes: 30,
            deadline: '',
            priorityStar: true,
            source: 'self',
            locked: false,
            persisted: false,
            reason: 'Yesterday',
          }]}
          assigned={[{
            key: 'asg-1',
            title: 'Continue IGCSE Maths',
            category: 'study',
            estimateMinutes: 45,
            deadline: '19:30',
            priorityStar: true,
            source: 'et_ai',
            locked: true,
            persisted: true,
          }]}
          onDone={() => undefined}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl p-6">
      <WeeklyPlan columns={columns} />
    </main>
  );
}
