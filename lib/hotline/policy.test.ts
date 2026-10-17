import assert from 'node:assert/strict';
import test from 'node:test';
import { prioritySeverity } from './policy';
import {
  canReopen,
  escalationTarget,
  kivReady,
  routeAddress,
  slaDueAt,
  staffCanSee,
  summariseHotline,
  type WorkCalendar,
} from './policy';

const calendar: WorkCalendar = {
  timezone: 'Asia/Kuala_Lumpur',
  workingDays: [1, 2, 3, 4, 5],
  startMinutes: 8 * 60,
  endMinutes: 17 * 60,
  holidays: [],
};

test('high priority is due after four working hours, including a weekend', () => {
  const monday = Date.UTC(2026, 9, 12, 2, 0, 0);
  assert.equal(slaDueAt(monday, 'high', calendar), Date.UTC(2026, 9, 12, 6, 0, 0));
  const friday = Date.UTC(2026, 9, 16, 8, 0, 0);
  assert.equal(slaDueAt(friday, 'high', calendar), Date.UTC(2026, 9, 19, 3, 0, 0));
  const holiday: WorkCalendar = { ...calendar, holidays: ['2026-10-19'] };
  assert.equal(slaDueAt(friday, 'high', holiday), Date.UTC(2026, 9, 20, 3, 0, 0));
});

test('sensitive tickets stay with the principal or safeguarding lead', () => {
  assert.equal(routeAddress('teacher', 'bullying'), 'safeguarding_lead');
  assert.equal(routeAddress('principal', 'safeguarding'), 'principal');
  assert.equal(routeAddress('academic_lead', 'academic'), 'academic_lead');
  assert.equal(staffCanSee('teacher', 'teacher', 'bullying'), false);
  assert.equal(staffCanSee('teacher', 'safeguarding_lead', 'safeguarding'), true);
  assert.equal(staffCanSee('teacher', 'teacher', 'attendance'), true);
  assert.equal(prioritySeverity('high'), 'high');
});

test('overdue tickets climb teacher, academic lead, then principal', () => {
  assert.equal(escalationTarget(0, false), 'teacher');
  assert.equal(escalationTarget(1, false), 'academic_lead');
  assert.equal(escalationTarget(2, false), 'principal');
  assert.equal(escalationTarget(3, false), null);
  assert.equal(escalationTarget(0, true), 'safeguarding_lead');
  assert.equal(escalationTarget(2, true), null);
});

test('reopen lasts seven days and keep-in-view needs a reason and a date', () => {
  const solved = Date.UTC(2026, 9, 1);
  assert.equal(canReopen('solved', solved, solved + 6 * 24 * 60 * 60 * 1000), true);
  assert.equal(canReopen('solved', solved, solved + 8 * 24 * 60 * 60 * 1000), false);
  assert.equal(canReopen('closed', solved, solved + 1000), false);
  assert.equal(kivReady('Waiting on a report', solved + 86_400_000, solved), null);
  assert.ok(kivReady('no', solved + 86_400_000, solved));
});

test('analytics hide groups under five', () => {
  const now = Date.UTC(2026, 9, 20);
  const row = (category: string, n: number) => Array.from({ length: n }, () => ({
    category,
    status: 'solved',
    createdAt: now - 86_400_000,
    solvedAt: now - 3_600_000,
    slaDueAt: now,
    rating: 4,
  }));
  const summary = summariseHotline([...row('academic', 5), ...row('fees', 2)], now);
  assert.deepEqual(summary.byCategory, [{ category: 'academic', n: 5 }]);
  assert.equal(summary.slaCompliance, 1);
  assert.equal(summary.satisfaction, 4);
  assert.equal(summary.overdue, null);
});
