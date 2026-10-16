'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { subscribeTeacherGoals, type DailyGoal } from '@/lib/db';
import { DashPage, DashHeader, Panel, PanelHeader, EmptyState } from '@/components/dash-ui';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { Target } from 'lucide-react';

export default function TeacherGoalsPage() {
  const { user } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeTeacherGoals(user.uid, setGoals);
  }, [user]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Class"
        title="Student goals"
        description="Goals appear here when a student in your class chooses to share them. Other teachers cannot open them."
      />
      {goals.length > 0 && (
        <DocumentDelivery
          documents={[textDocument({
            id: `shared-goals-${user?.uid || 'class'}`,
            title: 'Shared student goals',
            lines: goals.map(goal => `${goal.studentName || 'Student'}: ${goal.title} · ${goal.status}`),
          })]}
          studentIds={[...new Set(goals.map(goal => goal.studentId))]}
        />
      )}
      <Panel>
        <PanelHeader title="Shared with you" />
        {goals.length === 0 ? (
          <EmptyState icon={Target} title="No shared goals" body="When a student shares a goal and lists you as their teacher, it shows up here." />
        ) : goals.map(goal => (
          <article key={goal.id} className="border-b border-border py-3 last:border-0">
            <p className="text-sm font-semibold">{goal.studentName || 'Student'} · {goal.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {goal.dateKey} · {goal.status.replace('_', ' ')}
              {goal.progress != null ? ` · ${goal.progress}%` : ''}
              {goal.courseLabel ? ` · ${goal.courseLabel}` : ''}
            </p>
          </article>
        ))}
      </Panel>
    </DashPage>
  );
}
