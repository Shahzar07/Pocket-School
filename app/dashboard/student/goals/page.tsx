'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  completeDailyGoal, createDailyGoal, getEnrolledCourses, getModulesWithLessons, getPublishedExamsForStudent,
  goalDateKey, subscribeDailyGoals, updateDailyGoal, type DailyGoal,
} from '@/lib/db';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { authedFetch } from '@/lib/api-client';
import { AddGoalDialog, type GoalCourseOption } from '@/components/goals/add-goal-dialog';
import { DocumentDelivery } from '@/components/document-delivery';
import { textDocument } from '@/lib/documents/packet';
import { GoalsWorkspace, type WorkspaceGoal } from '@/components/goals/goals-workspace';
import { autoProgress, spawnNextGoal, suggestGoalsFromSignals, weakTopicsFromQuizzes, type GoalDraft, type SuggestedGoal } from '@/lib/insights/goals';
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
    priority: draft.priority,
    reminderTime: draft.reminderTime,
    quizTarget: draft.quizTarget,
    studioTask: draft.studioTask,
    shareWithTeachers: draft.shareWithTeachers,
    teacherIds: draft.shareWithTeachers ? draft.teacherIds : [],
    pomodoroWork: draft.pomodoroWork,
    pomodoroBreak: draft.pomodoroBreak,
    reflectionPrompt: draft.reflectionPrompt,
    sparksBonus: draft.sparksBonus,
    reward: draft.reward,
    lessonTitles: draft.lessonTitles,
    unitId: draft.unitId,
    progress: 0,
    source,
  };
}

export default function StudentGoalsPage() {
  const { user, profile } = useAuthSTORE();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; status: string }[]>([]);
  const [courses, setCourses] = useState<GoalCourseOption[]>([]);
  const [signals, setSignals] = useState<SuggestedGoal[]>([]);
  const [completedByCourse, setCompletedByCourse] = useState<Record<string, string[]>>({});
  const [quizzes, setQuizzes] = useState<{ unitId?: string; lessonId?: string; percentage?: number; weakestObjective?: string }[]>([]);
  const synced = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeDailyGoals(user.uid, setGoals);
    listSuggestions(user.uid).then(setSuggestions).catch(() => {});
    return unsub;
  }, [user]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') setOpen(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const enrolled = await getEnrolledCourses(user.uid).catch(() => []);
      const options = await Promise.all(enrolled.map(async row => {
        const tree = await getModulesWithLessons(row.course.id).catch(() => []);
        return {
          id: row.course.id,
          title: row.course.title,
          teacherId: row.course.ownerId,
          units: tree.map(item => ({
            id: item.module.id,
            title: item.module.title,
            lessons: item.lessons.map(lesson => ({ id: lesson.id, title: lesson.title })),
          })),
          completed: row.enrollment.completedLessons ?? [],
        };
      }));
      if (cancelled) return;
      setCourses(options.map(({ completed: _completed, ...option }) => option));
      setCompletedByCourse(Object.fromEntries(options.map(option => [option.id, option.completed])));
      const exams = await getPublishedExamsForStudent(options.map(option => option.id)).catch(() => []);
      const examDates = exams.flatMap(exam => {
        const millis = exam.availableFrom?.toMillis?.();
        if (!millis) return [];
        const date = new Date(millis);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return [{ title: exam.title, dateKey }];
      });
      const quizSnap = await getDocs(query(collection(db, 'unit_quiz_attempts'), where('studentId', '==', user.uid))).catch(() => null);
      const quizRows = quizSnap?.docs.map(docSnap => {
        const data = docSnap.data() as { unitId?: string; lessonId?: string; percentage?: number; weakestObjective?: string };
        return data;
      }) ?? [];
      if (cancelled) return;
      setQuizzes(quizRows);
      setSignals(suggestGoalsFromSignals({ weakTopics: weakTopicsFromQuizzes(quizRows), examDates }));
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const notify = (goalId: string, kind: string) => {
    authedFetch('/api/insights/goal-event', { method: 'POST', body: JSON.stringify({ goalId, kind }) }).catch(() => {});
  };

  useEffect(() => {
    if (!goals.length) return;
    for (const goal of goals) {
      if (goal.status === 'completed' || goal.status === 'excused') continue;
      const completed = goal.courseId ? completedByCourse[goal.courseId] ?? [] : [];
      const events = [
        ...completed.map(lessonId => ({ kind: 'lesson' as const, lessonId, unitId: goal.unitId })),
        ...quizzes
          .filter(quiz => !goal.unitId || quiz.unitId === goal.unitId)
          .map(quiz => ({ kind: 'quiz' as const, lessonId: quiz.lessonId, unitId: quiz.unitId, scorePercent: quiz.percentage })),
      ];
      const next = autoProgress(goal, events);
      const signature = `${goal.id}:${next.progress}:${next.status}:${next.quizScore ?? ''}`;
      if (next.progress === (goal.progress ?? 0) && next.status === goal.status) {
        synced.current.add(signature);
        continue;
      }
      if (synced.current.has(signature) || next.progress <= (goal.progress ?? 0)) continue;
      synced.current.add(signature);
      const doneLessons = (goal.lessonIds ?? []).filter(id => completed.includes(id));
      updateDailyGoal(goal.id, {
        progress: next.progress,
        status: next.status,
        quizScore: next.quizScore,
        completedLessonIds: doneLessons,
      }).then(() => {
        if (next.status === 'completed') notify(goal.id, 'achieved');
      }).catch(() => {});
    }
  }, [goals, completedByCourse, quizzes]);

  const create = async (draft: GoalDraft, source: DailyGoal['source'] = 'student') => {
    if (!user) return;
    const id = await createDailyGoal(draftToGoal(draft, user.uid, profile?.name ?? 'Student', source));
    toast.success('Goal saved');
    notify(id, 'created');
  };

  return (
    <>
      {user && (
        <DocumentDelivery
          documents={[textDocument({
            id: `goals-${user.uid}`,
            title: 'Goals',
            holderEmail: user.email ?? undefined,
            studentId: user.uid,
            lines: goals.length ? goals.map(goal => `${goal.dateKey} · ${goal.title} · ${goal.status}`) : ['No goals yet.'],
          })]}
          studentIds={[user.uid]}
        />
      )}
      <GoalsWorkspace
        viewer="student"
        goals={goals.map(toWorkspace)}
        suggestions={suggestions.filter(s => s.status === 'pending')}
        signalSuggestions={signals}
        onAdd={() => setOpen(true)}
        onToggle={async (goal, itemId) => {
          const checklist = (goal.checklist ?? []).map(item => item.id === itemId ? { ...item, done: !item.done } : item);
          const checklistDriven = goal.targetKind !== 'lessons' && goal.targetKind !== 'quiz_score' && goal.targetKind !== 'unit' && !(goal.lessonIds && goal.lessonIds.length > 0 && goal.targetKind === 'revision');
          const next = checklistDriven ? autoProgress({ ...goal, checklist }, []) : null;
          await updateDailyGoal(goal.id, {
            checklist,
            ...(next ? { progress: next.progress, status: next.status } : {}),
          });
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
              courseId: stored.courseId,
              courseLabel: stored.courseLabel,
              unitId: stored.unitId,
              priority: stored.priority,
              reminderTime: stored.reminderTime,
              quizTarget: stored.quizTarget,
              studioTask: stored.studioTask,
              shareWithTeachers: stored.shareWithTeachers,
              teacherIds: stored.teacherIds,
              pomodoroWork: stored.pomodoroWork,
              pomodoroBreak: stored.pomodoroBreak,
              reflectionPrompt: stored.reflectionPrompt,
              sparksBonus: stored.sparksBonus,
              reward: stored.reward,
              lessonTitles: stored.lessonTitles,
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
      <AddGoalDialog open={open} onClose={() => setOpen(false)} onCreate={draft => create(draft)} courses={courses} />
    </>
  );
}
