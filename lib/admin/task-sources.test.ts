import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SENSITIVE_CATEGORIES } from '../hotline/policy';
import { buildAdminTask, countByType, defaultTaskSwitches, emailAllowed, sourceHref, type AdminPushPrefs, type AdminTask } from './tasks';
import { draftForDocument, joinTaskType, sourceResolved } from './task-sources';

const prefs: AdminPushPrefs = {
  mode: 'instant',
  digestTimes: ['08:00'],
  quietHours: { start: '22:00', end: '07:00', tz: 'UTC' },
  types: defaultTaskSwitches(true),
};
const criticalSafeLine = { type: 'safeline_case' as const, slaTier: 'critical' as const, priority: 'critical' as const };
const registrationTask = { type: 'registration' as const, slaTier: 'medium' as const, priority: 'medium' as const };

function task(type: AdminTask['type'], tier: AdminTask['slaTier']): AdminTask {
  return buildAdminTask({
    type,
    entityType: type,
    entityPath: `${type}/1`,
    title: type,
    summary: 'Waiting',
    priority: tier,
    slaTier: tier,
    now: 1,
  });
}

test('a student join is a registration and a teacher join is a teacher application', () => {
  assert.equal(joinTaskType('student'), 'registration');
  assert.equal(joinTaskType('teacher'), 'teacher_verification');
  const student = draftForDocument('institutions/school/join_requests/u1', {
    status: 'pending',
    role: 'student',
    name: 'Aisha Rahman',
    email: 'aisha@example.com',
  });
  assert.equal(student?.type, 'registration');
  assert.equal(student?.summary.includes('Aisha'), false);
  assert.equal(student?.summary.includes('aisha@'), false);
  const built = student ? buildAdminTask({ ...student, now: 5 }) : null;
  assert.equal(built?.summary.includes('example.com'), false);
  assert.equal(sourceResolved('join_requests', { status: 'approved', role: 'student' }), true);
  assert.equal(sourceResolved('join_requests', { status: 'pending', role: 'student' }), false);
});

test('urgent SafeLine stays generic and critical', () => {
  assert.deepEqual([...SENSITIVE_CATEGORIES], ['bullying', 'safeguarding']);
  const draft = draftForDocument('hotline_tickets/abc', {
    status: 'pending',
    category: 'safeguarding',
    priority: 'high',
    body: 'Caller: Aisha Rahman, phone +60 12 345 6789',
  });
  assert.equal(draft?.type, 'safeline_case');
  assert.equal(draft?.priority, 'critical');
  assert.equal(draft?.summary.includes('Aisha'), false);
  assert.equal(sourceHref({ type: 'safeline_case', id: 'abc', entityType: 'hotline_tickets' }), '/dashboard/admin/hotline');
  assert.equal(sourceResolved('hotline_tickets', { status: 'solved', category: 'safeguarding', priority: 'high' }), true);
});

test('refunds, failed payouts, support, and courses map onto the shared task', () => {
  assert.equal(draftForDocument('refund_requests/c1', { status: 'requested', email: 'pay@example.com' })?.title, 'Refund request');
  assert.equal(draftForDocument('payouts/c1', { status: 'transfer_failed' })?.priority, 'high');
  assert.equal(draftForDocument('support_tickets/s1', { status: 'open', priority: 'urgent', body: 'name: Pat' })?.summary, 'A support ticket is open.');
  assert.equal(draftForDocument('courses/c1', { status: 'pending_approval', title: 'Biology 101' })?.type, 'course_review');
  assert.equal(draftForDocument('blogPosts/post', { status: 'draft' }), null);
  assert.equal(draftForDocument('institutions/school/billing/current', { phase: 'grace' })?.title, 'Failed payment');
  assert.equal(sourceResolved('courses', { status: 'published' }), true);
  assert.equal(sourceResolved('billing', { phase: 'active' }), true);
  assert.equal(sourceHref({ type: 'other', id: 's1', entityType: 'support_tickets' }), '/dashboard/helpdesk');
  assert.equal(sourceHref({ type: 'other', id: 'c1', entityType: 'refund_requests' }), '/dashboard/admin/finance');
});

test('counts put the urgent types first', () => {
  const rows = countByType([
    task('course_review', 'medium'),
    task('registration', 'high'),
    task('safeline_case', 'critical'),
    task('safeline_case', 'low'),
  ]);
  assert.equal(rows[0]?.type, 'safeline_case');
  assert.equal(rows[0]?.urgent, 1);
  assert.equal(rows[0]?.total, 2);
  assert.equal(rows[1]?.type, 'registration');
});

test('quiet hours and the account email toggle never mute critical SafeLine mail', () => {
  const quiet = Date.UTC(2026, 9, 20, 23, 0, 0);
  assert.equal(emailAllowed(false, prefs, criticalSafeLine, quiet), true);
  assert.equal(emailAllowed(true, prefs, registrationTask, quiet), false);
  assert.equal(emailAllowed(false, prefs, registrationTask, Date.UTC(2026, 9, 20, 12, 0, 0)), false);
  assert.equal(emailAllowed(true, { ...prefs, mode: 'digest' }, registrationTask, Date.UTC(2026, 9, 20, 12, 0, 0)), false);
});
