import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activityCsv,
  activityDocument,
  clampRetention,
  clientMayReport,
  diffRecords,
  filterActivity,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS,
} from './model';

describe('activity log model', () => {
  it('lets signed-in people report their own auth events and keeps failed logins server-only', () => {
    assert.equal(clientMayReport('auth.logout', 'student'), true);
    assert.equal(clientMayReport('auth.two_factor_failed', 'student'), true);
    assert.equal(clientMayReport('auth.login_failed', 'student'), false);
    assert.equal(clientMayReport('auth.login', ''), false);
    assert.equal(clientMayReport('content.edit', 'student'), false);
    assert.equal(clientMayReport('content.publish', 'teacher'), true);
    assert.equal(clientMayReport('content.delete', 'content_editor'), true);
    assert.equal(clientMayReport('allocation.edit', 'institution_admin'), true);
    assert.equal(clientMayReport('payments.edit', 'admin'), true);
    assert.equal(clientMayReport('payments.edit', 'teacher'), false);
    assert.equal(clientMayReport('flags.edit', 'super_admin'), true);
    assert.equal(clientMayReport('impersonation.start', 'support'), true);
    assert.equal(clientMayReport('impersonation.start', 'teacher'), false);
    assert.equal(clientMayReport('certificate.issue', 'admin'), false);
    assert.equal(clientMayReport('retention.purge', 'super_admin'), false);
    assert.equal(clientMayReport('not.real', 'super_admin'), false);
  });

  it('redacts secrets and records the changed fields', () => {
    const event = activityDocument({
      action: 'settings.edit',
      actorId: 'admin-1',
      actorEmail: 'admin@poketschool.ai',
      actorRole: 'super_admin',
      targetType: 'settings',
      targetId: 'payments',
      before: { name: 'old', password: 'hunter2', nested: { apiKey: 'sk_live' } },
      after: { name: 'new', password: 'changed', nested: { apiKey: 'sk_test' } },
    });
    assert.equal((event.before as { password: string }).password, '[redacted]');
    assert.equal((event.after as { nested: { apiKey: string } }).nested.apiKey, '[redacted]');
    assert.deepEqual(diffRecords(event.before, event.after), [
      { path: 'name', before: 'old', after: 'new' },
    ]);
    assert.equal(event.category, 'settings');
    assert.equal(event.actorId, 'admin-1');
  });

  it('prefixes spreadsheet formulas in the CSV export', () => {
    const csv = activityCsv([{
      category: 'auth',
      action: 'auth.login',
      actorId: 'u1',
      actorEmail: '=cmd|calc',
      actorRole: 'student',
      at: Date.parse('2026-03-01T00:00:00.000Z'),
      ip: '203.0.113.8',
      device: 'Poket',
      targetType: 'session',
      targetId: 'u1',
      targetLabel: '',
      before: null,
      after: null,
      diff: [],
    }]);
    assert.equal(csv.includes(`"'=cmd|calc"`), true);
    assert.equal(csv.split('\n')[0]?.startsWith('"Time"'), true);
  });

  it('clamps retention and filters the loaded page', () => {
    assert.equal(clampRetention(10), MIN_RETENTION_DAYS);
    assert.equal(clampRetention(99999), MAX_RETENTION_DAYS);
    assert.equal(clampRetention(Number.NaN), DEFAULT_RETENTION_DAYS);
    assert.equal(clampRetention(400.4), 400);
    const rows = [
      activityDocument({ action: 'auth.login', actorId: 'a', actorRole: 'student', actorEmail: 'a@poketschool.ai', targetType: 'session', targetId: 'a', at: 100 }),
      activityDocument({ action: 'content.publish', actorId: 'b', actorRole: 'teacher', actorEmail: 'b@poketschool.ai', targetType: 'course', targetId: 'bio', targetLabel: 'Biology', at: 200 }),
    ];
    assert.equal(filterActivity(rows, { q: 'biology' }).length, 1);
    assert.equal(filterActivity(rows, { category: 'auth' })[0]?.action, 'auth.login');
    assert.equal(filterActivity(rows, { from: 150 }).length, 1);
  });
});
