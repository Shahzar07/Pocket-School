import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromAssignment, fromGoal, monthCells, reschedule, weekCells } from './calendar';

test('the planner builds a month and a week and moves a due date', () => {
  const anchor = new Date(2026, 9, 19, 15, 30).getTime();
  assert.equal(monthCells(anchor).length, 42);
  assert.equal(weekCells(anchor).length, 7);
  const goal = fromGoal({ id: 'g1', title: 'Revise cells', studentId: 'student-1', dueAt: anchor });
  const moved = reschedule(goal, new Date(2026, 9, 21).getTime());
  assert.equal(new Date(moved.dueAt).getDate(), 21);
  assert.equal(new Date(moved.dueAt).getHours(), 15);
  assert.equal(moved.source, 'goal');
  const assignment = fromAssignment({ id: 'a1', title: 'Graphs', ownerId: 'teacher-1', dueAt: anchor, className: 'IGCSE Biology' });
  assert.equal(assignment.source, 'assignment');
});
