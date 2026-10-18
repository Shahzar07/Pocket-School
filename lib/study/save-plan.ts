'use client';

import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createDailyGoal, updateDailyGoal, type DailyGoal } from '@/lib/db';
import type { PlanSource, PlannedGoal, RescheduleEntry } from './planner';

function asSource(source: PlanSource | DailyGoal['source']): DailyGoal['source'] {
  if (source === 'self') return 'self';
  if (source === 'teacher') return 'teacher';
  if (source === 'parent') return 'parent';
  return 'et_ai';
}

/** Write the shared daily_goals row and the per-user copy under users/{uid}/goals. */
export async function savePlannedGoal(
  studentId: string,
  studentName: string,
  goal: PlannedGoal,
): Promise<string> {
  const id = await createDailyGoal({
    studentId,
    studentName,
    dateKey: goal.dateKey,
    title: goal.title,
    category: goal.category,
    estimateMinutes: goal.estimateMinutes,
    deadline: goal.deadline || '23:59',
    status: 'not_started',
    source: asSource(goal.source),
    link: goal.link,
    courseId: goal.courseId,
    courseLabel: goal.courseLabel,
    lessonId: goal.lessonId,
    parentVisibility: goal.parentVisibility,
    private: goal.private,
    catchUp: goal.catchUp,
    dueDateKey: goal.dueDateKey,
    rescheduleLimit: goal.rescheduleLimit,
    rescheduleCount: 0,
    priority: goal.priority,
    priorityStar: goal.priorityStar,
    order: goal.order,
    assignedByName: goal.source === 'et_ai' ? 'ET AI' : undefined,
  });
  await setDoc(doc(db, 'users', studentId, 'goals', id), {
    studentId,
    title: goal.title,
    dateKey: goal.dateKey,
    deadline: goal.deadline,
    estimateMinutes: goal.estimateMinutes,
    category: goal.category,
    status: 'not_started',
    source: goal.source,
    link: goal.link,
    parentVisibility: goal.parentVisibility,
    private: goal.private,
    catchUp: goal.catchUp,
    dueDateKey: goal.dueDateKey,
    rescheduleLimit: goal.rescheduleLimit,
    rescheduleCount: 0,
    order: goal.order,
    mirrorId: id,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
  return id;
}

export async function saveReschedule(studentId: string, goalId: string, entry: RescheduleEntry, next: {
  dateKey: string;
  deadline: string;
  rescheduleCount: number;
}): Promise<void> {
  await updateDailyGoal(goalId, {
    dateKey: next.dateKey,
    deadline: next.deadline,
    rescheduleCount: next.rescheduleCount,
  });
  await updateDoc(doc(db, 'users', studentId, 'goals', goalId), {
    dateKey: next.dateKey,
    deadline: next.deadline,
    rescheduleCount: next.rescheduleCount,
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);
  await addDoc(collection(db, 'users', studentId, 'goal_reschedules'), {
    ...entry,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
}
