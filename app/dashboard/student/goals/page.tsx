'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  completeDailyGoal, createDailyGoal, goalDateKey, subscribeDailyGoals, updateDailyGoal, type DailyGoal,
} from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { AddGoalDialog } from '@/components/goals/add-goal-dialog';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { autoProgress, spawnNextGoal, type GoalDraft } from '@/lib/insights/goals';
import { listSuggestions, logFocusSession, logStudyEvent, setSuggestionStatus } from '@/lib/insights/client';

function toWorkspace(goal: DailyGoal): WorkspaceGoal {
  return {
    ...goal,
    id: goal.id,
    createdAtMs: goal.createdAt?.toMillis?.(),
    startedAtMs: goal.startedAt?.toMillis?.(),
  };
}

function draftToGoal(draft: GoalDraft, studentId: string, studentName: string, source: DailyGoal['source']): Omit<DailyGoal, 'id' | 'createdAt'> {
  return {
    studentId,
    studentName,
    dateKey: draft.dateKey || goalDateKey(),
    title: draft.title,
    category: draft.category,
    estimateMinutes: draft.estimateMinutes,
    deadline: draft.deadline || '23:59',
    status: 'not_started',
    courseId: draft.courseId,
    courseLabel: draft.courseLabel,
    targetKind: draft.targetKind,
    unitTitle: draft.unitTitle,
    lessonIds: draft.lessonIds,
    freeTextTarget: draft.freeTextTarget,
    endDate: draft.endDate,
    recurrence: draft.recurrence,
    checklist: draft.checklist,
    reminderMinutes: draft.reminderMinutes,
    progress: 0,
    source,
  };
}

export default function StudentGoalsPage() {
  const { user, profile } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; status: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeDailyGoals(user.uid, setGoals);
    listSuggestions(user.uid).then(setSuggestions).catch(() => {});
    return unsub;
  }, [user]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') setOpen(true);
  }, []);

  const notify = (goalId: string, kind: string) => {
    authedFetch('/api/insights/goal-event', { method: 'POST', body: JSON.stringify({ goalId, kind }) }).catch(() => {});
  };

  const create = async (draft: GoalDraft, source: DailyGoal['source'] = 'student') => {
    if (!user) return;
    const id = await createDailyGoal(draftToGoal(draft, user.uid, profile?.name ?? 'Student', source));
    toast.success('Goal saved');
    notify(id, 'created');
  };

  return (
    <>
      <GoalsWorkspace
        viewer="student"
        goals={goals.map(toWorkspace)}
        suggestions={suggestions.filter(s => s.status === 'pending')}
        onAdd={() => setOpen(true)}
        onToggle={async (goal, itemId) => {
          const checklist = (goal.checklist ?? []).map(item => item.id === itemId ? { ...item, done: !item.done } : item);
          const next = autoProgress({ ...goal, checklist }, []);
          await updateDailyGoal(goal.id, { checklist, progress: next.progress, status: next.status });
        }}
        onReflect={(goal, text) => updateDailyGoal(goal.id, { reflection: text })}
        onComplete={async (goal) => {
          const stored = goals.find(g => g.id === goal.id);
          if (!stored) return;
          await completeDailyGoal(stored, true);
          const follow = spawnNextGoal(toWorkspace({ ...stored, status: 'completed' }));
          if (follow) {
            await createDailyGoal(draftToGoal({
              title: follow.title,
              category: stored.category,
              estimateMinutes: stored.estimateMinutes,
              deadline: stored.deadline,
              dateKey: follow.dateKey,
              endDate: stored.endDate,
              recurrence: stored.recurrence ?? 'none',
              targetKind: stored.targetKind ?? 'free_text',
              freeTextTarget: stored.freeTextTarget,
              unitTitle: stored.unitTitle,
              lessonIds: stored.lessonIds,
              checklist: follow.checklist ?? [],
              reminderMinutes: stored.reminderMinutes,
            }, stored.studentId, stored.studentName ?? 'Student', stored.source ?? 'student'));
          }
          notify(goal.id, 'achieved');
          authedFetch('/api/insights/award-goal', { method: 'POST', body: JSON.stringify({ goalId: goal.id }) })
            .then(res => { if (res.granted) toast.success(`+${res.amount} Sparks`); })
            .catch(() => {});
        }}
        onLogFocus={async (goal, actual, planned) => {
          if (!user) return;
          const now = new Date();
          await logFocusSession({ studentId: user.uid, goalId: goal.id, plannedMinutes: planned, actualMinutes: actual, courseId: goals.find(g => g.id === goal.id)?.courseId });
          await logStudyEvent({
            studentId: user.uid,
            minutes: actual,
            at: now.toISOString(),
            weekday: now.getDay(),
            hour: now.getHours(),
            source: 'focus',
            goalId: goal.id,
          });
          await updateDailyGoal(goal.id, {
            status: 'in_progress',
            focusMinutes: (goal.focusMinutes ?? 0) + actual,
            actualMinutes: actual,
          });
          notify(goal.id, 'focus');
          toast.success(`Logged ${actual} minutes`);
        }}
        onAcceptSuggestion={async (title, minutes, category) => {
          const match = suggestions.find(s => s.title === title && s.status === 'pending');
          await create({
            title,
            category: category ?? 'study',
            estimateMinutes: minutes,
            deadline: '18:00',
            dateKey: goalDateKey(),
            recurrence: 'none',
            targetKind: 'free_text',
            checklist: [],
          }, match ? 'parent' : 'ai');
          if (match) await setSuggestionStatus(match.id, 'accepted').catch(() => {});
        }}
      />
      <AddGoalDialog open={open} onClose={() => setOpen(false)} onCreate={draft => create(draft)} />
    </>
  );
}
