'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  checkGoalAlerts,
  completeDailyGoal,
  createDailyGoal,
  getEnrolledCourses,
  goalDateKey,
  subscribeDailyGoals,
  updateDailyGoal,
  type DailyGoal,
} from '@/lib/db';
import { AddGoalDialog, type GoalCourseOption } from '@/components/goals/add-goal-dialog';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { WeeklyPlan } from '@/components/goals/weekly-plan';
import { weekColumns, weekStartKey, requestReschedule } from '@/lib/study/planner';
import { saveReschedule } from '@/lib/study/save-plan';
import type { GoalDraft } from '@/lib/insights/goals';
import { Button } from '@/components/ui/button';
import { EscalationLadder } from '@/components/goals/escalation-ladder';

export default function StudentGoalsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[#1E6A83]">Opening your goals.</p>}>
      <StudentGoalsDesk />
    </Suspense>
  );
}

function StudentGoalsDesk() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [courses, setCourses] = useState<GoalCourseOption[]>([]);
  const [open, setOpen] = useState(false);
  const today = goalDateKey();

  useEffect(() => {
    if (params.get('add') === '1') setOpen(true);
  }, [params]);

  useEffect(() => {
    if (!user) return;
    return subscribeDailyGoals(user.uid, setGoals);
  }, [user]);

  useEffect(() => {
    if (!user || goals.length === 0) return;
    void checkGoalAlerts(user.uid, profile?.name ?? 'Student', goals, profile?.ageTier);
  }, [user, profile?.name, goals]);

  useEffect(() => {
    if (!user) return;
    getEnrolledCourses(user.uid)
      .then((rows) => setCourses(rows.map(({ course }) => ({
        id: course.id,
        title: course.title,
        teacherId: course.ownerId,
        units: [],
      }))))
      .catch(() => setCourses([]));
  }, [user]);

  const closeDialog = () => {
    setOpen(false);
    if (params.get('add') === '1') router.replace('/dashboard/student/goals');
  };

  const workspaceGoals: WorkspaceGoal[] = goals.map((goal) => ({ ...goal, id: goal.id }));
  const week = useMemo(() => weekColumns(goals, weekStartKey(today)), [goals, today]);

  const create = async (draft: GoalDraft) => {
    if (!user) return;
    await createDailyGoal({
      studentId: user.uid,
      studentName: profile?.name ?? user.displayName ?? 'Student',
      dateKey: draft.dateKey || today,
      title: draft.title,
      category: draft.category === 'revision' ? 'revision' : draft.category === 'practice' ? 'practice' : draft.category === 'reading' ? 'reading' : 'study',
      estimateMinutes: draft.estimateMinutes,
      deadline: draft.deadline || '23:59',
      status: 'not_started',
      source: 'student',
      targetKind: draft.targetKind,
      freeTextTarget: draft.freeTextTarget,
      courseId: draft.courseId,
      courseLabel: draft.courseLabel,
      unitId: draft.unitId,
      unitTitle: draft.unitTitle,
      lessonIds: draft.lessonIds,
      lessonTitles: draft.lessonTitles,
      endDate: draft.endDate,
      recurrence: draft.recurrence,
      checklist: draft.checklist,
      reminderMinutes: draft.reminderMinutes,
      reminderTime: draft.reminderTime,
      priority: draft.priority,
      quizTarget: draft.quizTarget,
      studioTask: draft.studioTask,
      shareWithTeachers: true,
      teacherIds: draft.teacherIds,
      assignedBy: user.uid,
      pomodoroWork: draft.pomodoroWork,
      pomodoroBreak: draft.pomodoroBreak,
      reflectionPrompt: draft.reflectionPrompt,
      sparksBonus: draft.sparksBonus,
      reward: draft.reward,
    });
    toast.success('Goal added.');
  };

  const reschedule = async (goal: DailyGoal) => {
    if (!user) return;
    const next = new Date();
    next.setDate(next.getDate() + 1);
    const dateKey = goalDateKey(next);
    const result = requestReschedule({
      id: goal.id,
      title: goal.title,
      dateKey: goal.dateKey,
      deadline: goal.deadline,
      estimateMinutes: goal.estimateMinutes,
      status: goal.status,
      source: goal.source,
      rescheduleCount: goal.rescheduleCount,
      rescheduleLimit: goal.rescheduleLimit,
      dueDateKey: goal.dueDateKey,
    }, { dateKey, deadline: goal.deadline || '19:30' }, new Date().toISOString());
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    await saveReschedule(user.uid, goal.id, result.entry, {
      dateKey: result.goal.dateKey,
      deadline: result.goal.deadline,
      rescheduleCount: result.goal.rescheduleCount ?? 1,
    }).catch(() => toast.error('Could not reschedule that goal.'));
  };

  if (!user) return <p className="p-8 text-sm text-[#1E6A83]">Sign in to set a goal.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#1E6A83]">Teachers and linked parents can see your goals, including ones you set yourself.</p>
      <GoalsWorkspace
        viewer="student"
        goals={workspaceGoals}
        onAdd={() => setOpen(true)}
        onToggle={async (goal, itemId) => {
          const checklist = (goal.checklist ?? []).map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
          await updateDailyGoal(goal.id, { checklist });
        }}
        onReflect={async (goal, text) => {
          await updateDailyGoal(goal.id, { reflection: text });
        }}
        onComplete={async (goal) => {
          const full = goals.find((item) => item.id === goal.id);
          if (!full) return;
          const onTime = Date.now() <= Date.parse(`${full.dateKey}T${full.deadline || '23:59'}:00`);
          const { xp } = await completeDailyGoal(full, onTime);
          toast.success(`+${xp} XP`);
        }}
        onLogFocus={async (goal, actual) => {
          await updateDailyGoal(goal.id, { focusMinutes: (goal.focusMinutes ?? 0) + actual });
        }}
      />
      <WeeklyPlan columns={week} />
      <EscalationLadder missed={goals.filter((goal) => goal.status === 'overdue').length} />
      <section className="rounded-[28px] border border-[#E7EDED] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Assigned goals</p>
        <p className="mt-1 text-sm text-[#203337]">Assigned goals stay on the plan. Move one to tomorrow if the day will not fit.</p>
        <ul className="mt-3 space-y-2">
          {goals.filter((goal) => goal.dateKey === today).map((goal) => (
            <li key={goal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E7EDED] px-3 py-2">
              <span className="text-sm font-semibold text-[#203337]">{goal.title}</span>
              <Button type="button" variant="outline" className="h-8 rounded-full text-xs" onClick={() => { void reschedule(goal); }}>
                Reschedule
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <AddGoalDialog open={open} onClose={closeDialog} onCreate={create} courses={courses} />
    </div>
  );
}
