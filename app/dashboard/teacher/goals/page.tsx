'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { classMemberIds, subscribeDailyGoals, subscribeTeacherGoals, type DailyGoal } from '@/lib/db';
import { DashPage, DashHeader, Panel, PanelHeader, EmptyState } from '@/components/dash-ui';
import { ClassAdherence } from '@/components/goals/class-adherence';
import { EscalationLadder } from '@/components/goals/escalation-ladder';
import { activeFocusMinutes, classAdherence, sourceLabel } from '@/lib/study/planner';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { Target } from 'lucide-react';

export default function TeacherGoalsPage() {
  const { user } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [source, setSource] = useState<'all' | 'student' | 'et_ai' | 'teacher' | 'parent' | 'institution'>('all');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const buckets = new Map<string, DailyGoal[]>();
    const publish = () => {
      const byId = new Map<string, DailyGoal>();
      for (const list of buckets.values()) {
        for (const goal of list) byId.set(goal.id, goal);
      }
      if (!cancelled) setGoals([...byId.values()]);
    };
    unsubs.push(subscribeTeacherGoals(user.uid, (rows) => {
      buckets.set('listed', rows);
      publish();
    }));
    void classMemberIds(user.uid).then((ids) => {
      if (cancelled) return;
      for (const studentId of ids) {
        unsubs.push(subscribeDailyGoals(studentId, (rows) => {
          buckets.set(studentId, rows);
          publish();
        }));
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      unsubs.forEach((stop) => stop());
    };
  }, [user]);

  const visible = useMemo(() => goals.filter((goal) => {
    if (source === 'all') return true;
    if (source === 'student') return goal.source === 'self' || goal.source === 'student' || !goal.source;
    if (source === 'et_ai') return goal.source === 'et_ai' || goal.source === 'ai';
    return goal.source === source;
  }), [goals, source]);

  const adherence = useMemo(() => {
    const byStudent = new Map<string, DailyGoal[]>();
    for (const goal of visible) {
      const list = byStudent.get(goal.studentId) ?? [];
      list.push(goal);
      byStudent.set(goal.studentId, list);
    }
    return classAdherence([...byStudent.entries()].map(([studentId, studentGoals]) => ({
      studentId,
      name: studentGoals[0]?.studentName || 'Student',
      goals: studentGoals,
    })));
  }, [visible]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Class"
        title="Student goals"
        description="Every goal for a student in your class, including ones they set. Other teachers cannot open them."
      />
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'All'],
          ['student', 'Student'],
          ['et_ai', 'ET AI'],
          ['teacher', 'Teacher'],
          ['parent', 'Parent'],
          ['institution', 'School'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={`h-9 rounded-full px-3 text-sm font-semibold ${source === value ? 'bg-[#3FE0D0] text-[#203337]' : 'border border-[#E7EDED] text-[#1E6A83]'}`} onClick={() => setSource(value)}>{label}</button>
        ))}
      </div>
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
      <EscalationLadder missed={visible.filter((goal) => goal.status === 'overdue').length} />
      <ClassAdherence classRate={adherence.classRate} rows={adherence.rows} />
      <Panel>
        <PanelHeader title="By student" />
        {visible.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet" body="Goals from your class show up here, including ones a student sets." />
        ) : visible.map(goal => {
          const focus = activeFocusMinutes(goal);
          return (
            <article key={goal.id} className="border-b border-border py-3 last:border-0">
              <p className="text-sm font-semibold">{goal.studentName || 'Student'} · {goal.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {sourceLabel(goal.source)} · {goal.status.replace('_', ' ')} · due {goal.dateKey} {goal.deadline || ''}
                {focus != null ? ` · focus ${focus} min` : ''}
                {(goal.rescheduleCount ?? 0) > 0 ? ` · rescheduled ${goal.rescheduleCount}` : ''}
                {goal.status === 'completed' ? ' · completed' : ''}
              </p>
            </article>
          );
        })}
      </Panel>
    </DashPage>
  );
}
