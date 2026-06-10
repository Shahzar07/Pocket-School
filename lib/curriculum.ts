// ─── Curriculum progression helpers ─────────────────────────────
// Pure functions that compute unit/lesson lock states for a curriculum
// module (Course.kind === 'curriculum'). Unit 1 starts unlocked; unit N
// unlocks once the student has a passed mastery-quiz attempt for unit N-1.

import type { Enrollment, Lesson, Module, UnitQuizAttempt } from './db';

export type UnitState = 'locked' | 'in_progress' | 'passed';
export type CurriculumLessonState = 'locked' | 'available' | 'completed';

export interface UnitStatus {
  unitId: string;
  state: UnitState;
  completedLessons: number;
  totalLessons: number;
  /** Best mastery-quiz percentage across attempts, if any. */
  bestQuizPercentage?: number;
  attemptCount: number;
}

/**
 * Compute the status of each unit in display order.
 * `units` must be the published units of one curriculum module, sorted by order.
 */
export function getUnitStatuses(
  units: { module: Module; lessons: Lesson[] }[],
  enrollment: Enrollment | null,
  attempts: UnitQuizAttempt[]
): UnitStatus[] {
  const completedIds = new Set(enrollment?.completedLessons ?? []);
  const statuses: UnitStatus[] = [];
  let previousPassed = true; // unit 1 is always unlocked

  for (const unit of units) {
    const unitAttempts = attempts.filter(a => a.unitId === unit.module.id);
    const passed = unitAttempts.some(a => a.passed);
    const bestQuizPercentage = unitAttempts.length
      ? Math.max(...unitAttempts.map(a => a.percentage))
      : undefined;
    const completedLessons = unit.lessons.filter(l => completedIds.has(l.id)).length;

    let state: UnitState;
    if (!previousPassed) state = 'locked';
    else if (passed) state = 'passed';
    else state = 'in_progress';

    statuses.push({
      unitId: unit.module.id,
      state,
      completedLessons,
      totalLessons: unit.lessons.length,
      bestQuizPercentage,
      attemptCount: unitAttempts.length,
    });
    previousPassed = passed;
  }
  return statuses;
}

/**
 * Lock state for one lesson inside a unit. Lessons unlock sequentially within
 * an unlocked unit; the mastery quiz additionally requires all other lessons
 * in the unit to be complete.
 */
export function getCurriculumLessonStatus(
  lesson: Lesson,
  unitLessons: Lesson[],
  unitState: UnitState,
  completedIds: Set<string>
): CurriculumLessonState {
  if (completedIds.has(lesson.id)) return 'completed';
  if (unitState === 'locked') return 'locked';

  if (lesson.isUnitQuiz) {
    const others = unitLessons.filter(l => l.id !== lesson.id);
    return others.every(l => completedIds.has(l.id)) ? 'available' : 'locked';
  }

  const idx = unitLessons.findIndex(l => l.id === lesson.id);
  if (idx <= 0) return 'available';
  const prev = unitLessons[idx - 1];
  return completedIds.has(prev.id) ? 'available' : 'locked';
}
