import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESK_SLA_MS } from '../bullying/policy';
import {
  ADMIN_SLA_MS,
  androidChannel,
  buildAdminTask,
  criticalSafeline,
  defaultTaskSwitches,
  deepLinkFor,
  digestDue,
  dueAtFor,
  inQuietHours,
  parseAdminTask,
  presentTask,
  pushDecision,
  pushPayload,
  readAdminPushPrefs,
  reasonRequired,
  resolutionProblem,
  safeSummary,
  slaMs,
  withResolution,
  type AdminPushPrefs,
  type AdminTask,
} from './tasks';

const prefs: AdminPushPrefs = {
  mode: 'instant',
  digestTimes: ['08:00'],
  quietHours: { start: '22:00', end: '07:00', tz: 'UTC' },
  types: defaultTaskSwitches(true),
};
const registration = { type: 'registration' as const, slaTier: 'medium' as const, priority: 'medium' as const };

test('SLA clocks match the SafeLine desk', () => {
  assert.deepEqual(ADMIN_SLA_MS, DESK_SLA_MS);
  assert.equal(slaMs('critical'), DESK_SLA_MS.critical);
  assert.equal(slaMs('critical'), 15 * 60 * 1000);
  assert.equal(slaMs('high'), 60 * 60 * 1000);
  assert.equal(slaMs('medium'), 24 * 60 * 60 * 1000);
  assert.equal(slaMs('low'), 72 * 60 * 60 * 1000);
  assert.equal(dueAtFor(1_000, 'critical') - 1_000, DESK_SLA_MS.critical);
});

test('summary never keeps an email, a phone, or a labelled name', () => {
  const summary = safeSummary('Student: Aisha Rahman called +60 12 345 6789 from aisha@school.edu about the case.');
  assert.equal(summary.includes('Aisha'), false);
  assert.equal(summary.includes('@'), false);
  assert.equal(summary.includes('6789'), false);
  assert.match(summary, /\[hidden\]/);
});

test('refPath aliases entityPath and the push payload matches the app contract', () => {
  const task = buildAdminTask({
    type: 'course_review',
    entityType: 'courses',
    entityPath: 'courses/igcse-maths',
    title: 'Review IGCSE Maths',
    summary: 'A teacher submitted this course.',
    priority: 'medium',
    scope: { institutionId: 'school-1' },
    now: 1_700_000_000_000,
  });
  assert.equal(task.refPath, task.entityPath);
  assert.equal(task.dueAt - task.createdAt, DESK_SLA_MS.medium);
  const payload = pushPayload(task);
  assert.deepEqual(Object.keys(payload).sort(), ['deepLink', 'entityPath', 'priority', 'slaTier', 'taskId', 'title', 'type']);
  assert.equal(payload.deepLink, deepLinkFor(task.id));
  assert.equal(payload.entityPath, 'courses/igcse-maths');
  assert.equal(androidChannel(task), 'admin');
});

test('critical SafeLine uses the emergency channel', () => {
  const task = buildAdminTask({
    type: 'safeline_case',
    entityType: 'hotline_tickets',
    entityPath: 'hotline_tickets/abc',
    title: 'Student: Aisha Rahman',
    summary: 'parent: Maya said email maya@school.edu',
    priority: 'critical',
    slaTier: 'critical',
    now: 10,
  });
  assert.equal(task.title, 'SafeLine case');
  assert.equal(task.summary.includes('Aisha'), false);
  assert.equal(task.summary.includes('@'), false);
  assert.equal(androidChannel(task), 'emergency');
  assert.equal(criticalSafeline(task), true);
  const high = buildAdminTask({
    type: 'safeline_case',
    entityType: 'hotline_tickets',
    entityPath: 'hotline_tickets/high',
    title: 'SafeLine case',
    summary: 'A high ticket is waiting.',
    priority: 'high',
    slaTier: 'high',
    now: 10,
  });
  assert.equal(androidChannel(high), 'admin');
  assert.equal(criticalSafeline(high), false);
  const medium = { ...high, slaTier: 'medium' as const, priority: 'medium' as const };
  assert.equal(androidChannel(medium), 'admin');
  const priorityCritical = { ...high, slaTier: 'high' as const, priority: 'critical' as const };
  assert.equal(androidChannel(priorityCritical), 'emergency');
});

test('reject and dismiss require a reason, and the flat fields stay in sync', () => {
  assert.equal(reasonRequired('reject'), true);
  assert.equal(reasonRequired('dismiss'), true);
  assert.equal(reasonRequired('done'), false);
  assert.match(resolutionProblem('dismiss', ''), /reason/);
  assert.equal(resolutionProblem('done', ''), '');
  const task = buildAdminTask({
    type: 'report',
    entityType: 'reports',
    entityPath: 'reports/1',
    title: 'Report',
    summary: 'A report is waiting.',
    priority: 'low',
    now: 50,
  });
  const resolved = withResolution(task, { action: 'reject', reason: 'Duplicate report', by: 'admin-1', at: 80 }, 'dismissed');
  assert.equal(resolved.resolvedAt, 80);
  assert.equal(resolved.resolvedBy, 'admin-1');
  assert.equal(resolved.resolutionReason, 'Duplicate report');
  assert.equal(resolved.resolution?.action, 'reject');
});

test('safeguarding names stay hidden unless the viewer is a lead', () => {
  const task: AdminTask = buildAdminTask({
    type: 'amber_request',
    entityType: 'emergency_alerts',
    entityPath: 'emergency_alerts/1',
    title: 'Amber',
    summary: 'A request is waiting.',
    priority: 'high',
    now: 1,
  });
  const leaked = { ...task, title: 'Amber for Aisha Rahman', summary: 'Student: Aisha Rahman' };
  const hidden = presentTask(leaked, { staffRole: 'admin', staffPost: 'teacher' });
  assert.equal(hidden.title, 'Amber request');
  assert.equal(hidden.summary.includes('Aisha'), false);
  const lead = presentTask(leaked, { staffRole: 'admin', staffPost: 'safeguarding_lead' });
  assert.equal(lead.title, 'Amber for Aisha Rahman');
});

test('quiet hours never mute critical SafeLine, and digest holds other task types', () => {
  const night = Date.UTC(2026, 9, 19, 23, 0, 0);
  const critical = { type: 'safeline_case' as const, slaTier: 'critical' as const, priority: 'critical' as const };
  const high = { type: 'safeline_case' as const, slaTier: 'high' as const, priority: 'high' as const };
  assert.equal(inQuietHours(prefs, night), true);
  assert.equal(pushDecision(prefs, registration, night), 'quiet');
  assert.equal(pushDecision(prefs, critical, night), 'send');
  const digest: AdminPushPrefs = { ...prefs, mode: 'digest' };
  const day = Date.UTC(2026, 9, 19, 12, 0, 0);
  assert.equal(pushDecision(digest, registration, day), 'digest');
  assert.equal(pushDecision({ ...prefs, types: { ...prefs.types, registration: false } }, registration, day), 'muted');
  assert.equal(pushDecision({ ...prefs, types: { ...prefs.types, safeline_case: false } }, high, day), 'muted');
  assert.equal(pushDecision({ ...prefs, types: { ...prefs.types, safeline_case: false } }, critical, day), 'send');
});

test('a digest time fires once inside the window', () => {
  const atEight = Date.UTC(2026, 9, 19, 8, 5, 0);
  const digest: AdminPushPrefs = { ...prefs, mode: 'digest', digestTimes: ['08:00'] };
  assert.equal(digestDue(digest, atEight), true);
  assert.equal(digestDue({ ...digest, lastDigestAt: atEight - 60_000 }, atEight), false);
});

test('prefs reading keeps critical SafeLine on and maps the old admin flag', () => {
  const read = readAdminPushPrefs({
    mode: 'digest',
    digestTimes: ['nope', '18:30'],
    quietHours: { start: '21:00', end: '06:00', tz: 'Asia/Kuala_Lumpur' },
    categories: { admin: false, emergency: false },
  });
  assert.equal(read.mode, 'digest');
  assert.deepEqual(read.digestTimes, ['18:30']);
  assert.equal(read.types.registration, false);
  assert.equal(read.types.course_review, false);
  assert.equal(read.types.amber_request, false);
  assert.equal(read.types.safeline_case, true);
  assert.equal(read.quietHours.tz, 'Asia/Kuala_Lumpur');
  const kept = readAdminPushPrefs({ categories: { admin: true, emergency: true } });
  assert.deepEqual(kept.digestTimes, ['08:00', '17:00']);
  assert.equal(kept.types.registration, true);
  assert.equal(kept.types.report, true);
  assert.equal(kept.types.safeline_case, true);
  const explicit = readAdminPushPrefs({ types: { registration: false, safeline_case: false } });
  assert.equal(explicit.types.registration, false);
  assert.equal(explicit.types.safeline_case, false);
  assert.equal(explicit.types.other, true);
});

test('a stored task keeps refPath equal to entityPath when it is read back', () => {
  const task = buildAdminTask({
    type: 'report',
    entityType: 'reports',
    entityPath: 'reports/9',
    title: 'Community report',
    summary: 'A community report is waiting.',
    priority: 'low',
    now: 40,
  });
  const read = parseAdminTask(task.id, { ...task, refPath: 'legacy/path', resolution: null });
  assert.equal(read?.refPath, 'reports/9');
  assert.equal(read?.entityPath, 'reports/9');
  assert.equal(read?.slaTier, 'low');
});
