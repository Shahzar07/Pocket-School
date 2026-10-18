import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudyPlan,
  canDeleteGoal,
  catchUpFor,
  activeFocusMinutes,
  classAdherence,
  defaultAvailability,
  escalationFor,
  limitsForAge,
  mergeLimits,
  minutesLeftToday,
  planVsDone,
  rebalance,
  requestReschedule,
  shouldAutoTick,
  viewersForAssignment,
  weekColumns,
  type PlannedGoal,
  type StoredGoal,
} from './planner';

const today = '2026-10-19'; // Monday

test('the planner works backwards from an exam into evening slots', () => {
  const first = buildStudyPlan({
    today,
    limits: limitsForAge('teen'),
    items: [{
      id: 'exam-1',
      title: 'Prepare for the maths paper',
      kind: 'exam',
      dueDateKey: '2026-10-21',
      dueTime: '09:00',
      minutes: 90,
      weight: 10,
    }],
  });
  const again = buildStudyPlan({
    today,
    limits: limitsForAge('teen'),
    items: [{
      id: 'exam-1',
      title: 'Prepare for the maths paper',
      kind: 'exam',
      dueDateKey: '2026-10-21',
      dueTime: '09:00',
      minutes: 90,
      weight: 10,
    }],
  });
  assert.deepEqual(first, again);
  assert.ok(first.goals.length >= 2);
  assert.ok(first.goals.every((goal) => goal.dateKey <= '2026-10-21'));
  assert.ok(first.goals.every((goal) => goal.source === 'et_ai'));
  assert.equal(first.goals[0]?.link.type, 'exam');
  const perDay = new Map<string, number>();
  for (const goal of first.goals) perDay.set(goal.dateKey, (perDay.get(goal.dateKey) ?? 0) + 1);
  for (const count of perDay.values()) assert.ok(count <= 5);
});

test('a younger learner stays inside the age cap', () => {
  const plan = buildStudyPlan({
    today,
    limits: mergeLimits(limitsForAge('under13'), { maxDailyMinutes: 180, maxGoalsPerDay: 9 }),
    items: [{
      id: 'lesson-1',
      title: 'Fractions',
      kind: 'lesson',
      lessonId: 'lesson-1',
      dueDateKey: '2026-10-19',
      minutes: 120,
    }],
  });
  const monday = plan.goals.filter((goal) => goal.dateKey === today);
  const minutes = monday.reduce((sum, goal) => sum + goal.estimateMinutes, 0);
  assert.ok(minutes <= 45);
  assert.ok(monday.length <= 3);
  assert.deepEqual(plan.goals[0]?.link, { type: 'lesson', id: 'lesson-1' });
});

test('assigned goals cannot be deleted and reschedules are logged', () => {
  assert.equal(canDeleteGoal('self'), true);
  assert.equal(canDeleteGoal('student'), true);
  assert.equal(canDeleteGoal('et_ai'), false);
  assert.equal(canDeleteGoal('teacher'), false);
  assert.equal(canDeleteGoal('parent'), false);
  const goal: StoredGoal = {
    id: 'g1',
    title: 'Finish the worksheet',
    dateKey: today,
    deadline: '19:30',
    estimateMinutes: 30,
    status: 'not_started',
    source: 'teacher',
    rescheduleCount: 0,
    rescheduleLimit: 1,
    dueDateKey: '2026-10-20',
  };
  const moved = requestReschedule(goal, { dateKey: '2026-10-20', deadline: '18:00' }, '2026-10-19T10:00:00');
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.goal.rescheduleCount, 1);
  assert.equal(moved.entry.fromDate, today);
  assert.equal(moved.entry.toDate, '2026-10-20');
  const blocked = requestReschedule(moved.goal, { dateKey: '2026-10-21', deadline: '18:00' }, '2026-10-19T11:00:00');
  assert.equal(blocked.ok, false);
});

test('overdue assigned work rolls into a catch-up slot and escalates', () => {
  const overdue: StoredGoal = {
    id: 'g2',
    title: 'Revise algebra',
    dateKey: '2026-10-18',
    deadline: '19:00',
    estimateMinutes: 30,
    status: 'overdue',
    source: 'et_ai',
    link: { type: 'lesson', id: 'alg' },
    missCount: 3,
  };
  const catchUps = catchUpFor([overdue], today, defaultAvailability(), limitsForAge('adult'));
  assert.ok(catchUps.some((goal) => goal.catchUp && goal.title.startsWith('Catch up:')));
  const ladder = escalationFor(3, limitsForAge('teen'));
  assert.equal(ladder.studentReminder, true);
  assert.equal(ladder.parentNotify, true);
  assert.equal(ladder.teacherFlag, true);
  assert.equal(ladder.concern?.kind, 'missed_goals');
  assert.equal(escalationFor(1, limitsForAge('teen')).teacherFlag, false);
  assert.equal(escalationFor(1, limitsForAge('teen')).studentReminder, true);
  assert.equal(escalationFor(1, limitsForAge('teen')).parentNotify, false);
  assert.equal(escalationFor(2, limitsForAge('teen')).parentNotify, true);
  assert.equal(escalationFor(2, limitsForAge('teen')).teacherFlag, false);
});

test('finishing a linked lesson ticks the goal, and a self-set goal stays in the class count', () => {
  assert.equal(shouldAutoTick({ link: { type: 'lesson', id: 'alg' }, status: 'not_started' }, { kind: 'lesson', id: 'alg' }), true);
  assert.equal(shouldAutoTick({ link: { type: 'lesson', id: 'alg' }, status: 'completed' }, { kind: 'lesson', id: 'alg' }), false);
  assert.equal(shouldAutoTick({ link: { type: 'assignment', id: 'hw' }, status: 'not_started' }, { kind: 'assignment', id: 'hw' }), true);
  const adherence = classAdherence([{
    studentId: 's1',
    name: 'Alex Student',
    goals: [
      { id: 'a', title: 'Secret note', dateKey: today, deadline: '19:00', estimateMinutes: 20, status: 'overdue', source: 'self', private: true },
      { id: 'b', title: 'Assigned paper', dateKey: today, deadline: '19:00', estimateMinutes: 30, status: 'completed', source: 'teacher', private: false },
    ],
  }]);
  assert.equal(adherence.rows[0]?.assigned, 2);
  assert.equal(adherence.rows[0]?.onTime, 1);
  assert.equal(adherence.classRate, 50);
  assert.equal(JSON.stringify(adherence).includes('Secret note'), false);
  assert.equal(activeFocusMinutes({ status: 'in_progress', focusMinutes: 12 }), 12);
  assert.equal(activeFocusMinutes({ status: 'completed', focusMinutes: 12 }), null);
});

test('the weekly plan and parent view compare planned time with time done', () => {
  const columns = weekColumns([
    { title: 'Fractions', dateKey: '2026-10-19', estimateMinutes: 30, status: 'completed', actualMinutes: 28, source: 'et_ai' },
    { title: 'Private', dateKey: '2026-10-19', estimateMinutes: 40, status: 'not_started', source: 'self', private: true },
  ], '2026-10-18');
  const monday = columns.find((column) => column.dateKey === '2026-10-19');
  assert.equal(monday?.plannedMinutes, 70);
  assert.equal(monday?.doneMinutes, 28);
  assert.equal(monday?.goals.length, 2);
  const face = planVsDone([
    { estimateMinutes: 30, actualMinutes: 28, status: 'completed' },
    { estimateMinutes: 40, actualMinutes: 0, status: 'overdue', private: true },
  ]);
  assert.equal(face.planned, 70);
  assert.equal(face.actual, 28);
  assert.equal(face.missed, 1);
});

test('a class allocation reaches that class and skips everyone else', () => {
  const roster = [
    { role: 'student', userId: 'a', cohortIds: ['class-1'] },
    { role: 'student', userId: 'b', cohortIds: ['class-2'] },
  ];
  const hit = viewersForAssignment(['class:class-1'], roster);
  assert.deepEqual(hit.map((viewer) => viewer.userId), ['a']);
});

test('getting ahead pulls the next block forward without passing the daily cap', () => {
  const limits = limitsForAge('adult');
  const goals: PlannedGoal[] = [
    {
      key: 'today',
      title: 'Short review',
      dateKey: today,
      deadline: '19:30',
      estimateMinutes: 30,
      category: 'study',
      source: 'et_ai',
      link: { type: 'lesson', id: 'l1' },
      priority: 'medium',
      priorityStar: false,
      parentVisibility: true,
      private: false,
      catchUp: false,
      dueDateKey: '2026-10-22',
      rescheduleLimit: 2,
      order: 0,
    },
    {
      key: 'later',
      title: 'Next lesson',
      dateKey: '2026-10-20',
      deadline: '19:30',
      estimateMinutes: 30,
      category: 'study',
      source: 'et_ai',
      link: { type: 'lesson', id: 'l2' },
      priority: 'medium',
      priorityStar: false,
      parentVisibility: true,
      private: false,
      catchUp: false,
      dueDateKey: '2026-10-22',
      rescheduleLimit: 2,
      order: 1,
    },
  ];
  const moved = rebalance(goals, today, limits);
  assert.equal(moved.find((goal) => goal.key === 'later')?.dateKey, today);
  const minutes = moved.filter((goal) => goal.dateKey === today).reduce((sum, goal) => sum + goal.estimateMinutes, 0);
  assert.ok(minutes <= limits.maxDailyMinutes);
});

test('evening time left ignores the school day that has already passed', () => {
  const left = minutesLeftToday(new Date(2026, 9, 19, 17, 0), defaultAvailability());
  assert.equal(left, 150);
});
