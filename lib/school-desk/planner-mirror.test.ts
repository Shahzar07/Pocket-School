import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoDesk } from './model';
import { plannerOps, weekdayDue } from './planner-mirror';

test('a weekday label lands on that weekday', () => {
  const monday = new Date('2026-10-19T08:00:00');
  const due = new Date(weekdayDue('Tue 10:00', monday.getTime()));
  assert.equal(due.getDay(), 2);
  assert.equal(due.getHours(), 10);
});

test('desk changes mirror classes, exams, goals and attendance', () => {
  const demo = createDemoDesk();
  const blank = {
    ...demo,
    classes: [],
    enrolments: [],
    assessments: [],
    goals: [],
    attendance: [],
  };
  const ops = plannerOps(blank, demo, demo.actorId);
  const kinds = new Set(ops.filter((item) => item.op === 'set').map((item) => item.data?.kind));
  assert.equal(kinds.has('class'), true);
  assert.equal(kinds.has('exam'), true);
  assert.equal(kinds.has('assignment'), true);
  assert.equal(kinds.has('goal'), true);
  assert.equal(kinds.has('attendance'), true);
  const exam = ops.find((item) => item.data?.kind === 'exam');
  assert.ok(exam?.data?.studentIds.includes('stu-amina'));
  const removed = plannerOps(demo, blank, demo.actorId);
  assert.ok(removed.some((item) => item.op === 'delete' && item.id.startsWith('desk-class-')));
});
