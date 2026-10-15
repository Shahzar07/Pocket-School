import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIRST_SUPER_ADMIN,
  INITIAL_SUPER_ADMINS,
  parseBootstrapEmails,
  auditEntry,
  customClaimsFor,
  decideModeration,
  decideRoleChange,
  decideSparks,
  directoryCsv,
  filterAudit,
  filterDirectory,
  loginBlocked,
  mfaRequired,
  requiresAdminLogin,
  platformKpis,
  resolveStaffRole,
  sessionExpired,
  systemHealth,
  type DirectoryUser,
} from './admin-console';

const owner = { id: 'harry', email: FIRST_SUPER_ADMIN.email, role: 'teacher' };
const admin = { id: 'ada', email: 'ada@poketschool.ai', role: 'admin', adminRole: 'admin' };
const editor = { id: 'ed', email: 'ed@poketschool.ai', role: 'admin', adminRole: 'content_editor' };

test('the owner email is the first super admin and admin accounts need MFA', () => {
  assert.equal(FIRST_SUPER_ADMIN.name, 'Harry Seggu');
  assert.equal(INITIAL_SUPER_ADMINS.map(item => item.email).join(','), 'harry.seggu@gmail.com,shahzarrayyan123@gmail.com');
  assert.equal(resolveStaffRole(owner), 'super_admin');
  assert.equal(resolveStaffRole({ email: 'Harry.Seggu@gmail.com', role: 'student' }), 'super_admin');
  assert.deepEqual(parseBootstrapEmails(undefined), ['harry.seggu@gmail.com', 'shahzarrayyan123@gmail.com']);
  assert.deepEqual(
    parseBootstrapEmails('harry.seggu@gmail.com, shahzarrayyan123@gmail.com'),
    ['harry.seggu@gmail.com', 'shahzarrayyan123@gmail.com'],
  );
  assert.equal(resolveStaffRole({ role: 'admin' }), 'admin');
  assert.equal(resolveStaffRole(editor), 'content_editor');
  assert.equal(mfaRequired('super_admin'), true);
  assert.equal(mfaRequired('admin'), true);
  assert.equal(mfaRequired('support'), false);
  assert.equal(requiresAdminLogin(owner), true);
  assert.equal(requiresAdminLogin({ email: 'sam@school.edu', role: 'student' }), false);
  assert.deepEqual(customClaimsFor('super_admin', 'admin'), { adminRole: 'super_admin', role: 'admin' });
});

test('a super admin cannot remove the last super admin or demote themselves', () => {
  const only = decideRoleChange({
    actorId: 'harry', actor: 'super_admin', targetId: 'harry', target: 'super_admin', next: 'admin', superAdminIds: ['harry'],
  });
  assert.equal(only.ok, false);
  const self = decideRoleChange({
    actorId: 'harry', actor: 'super_admin', targetId: 'harry', target: 'super_admin', next: 'admin', superAdminIds: ['harry', 'ada'],
  });
  assert.equal(self.ok, false);
  const other = decideRoleChange({
    actorId: 'ada', actor: 'super_admin', targetId: 'harry', target: 'super_admin', next: 'admin', superAdminIds: ['harry', 'ada'],
  });
  assert.equal(other.ok, true);
  const blocked = decideRoleChange({
    actorId: 'ada', actor: 'admin', targetId: 'harry', target: 'super_admin', next: 'admin', superAdminIds: ['harry'],
  });
  assert.equal(blocked.ok, false);
});

test('suspension needs a reason and cannot lock the last super admin', () => {
  assert.equal(loginBlocked('suspended'), true);
  assert.equal(loginBlocked('banned'), true);
  assert.equal(loginBlocked('deleted'), true);
  assert.equal(loginBlocked('active'), false);
  const missing = decideModeration({
    actorId: 'ada', actor: 'admin', targetId: 'sam', target: null, next: 'suspended', superAdminIds: ['harry'], reason: ' ',
  });
  assert.equal(missing.ok, false);
  const last = decideModeration({
    actorId: 'ada', actor: 'super_admin', targetId: 'harry', target: 'super_admin', next: 'banned', superAdminIds: ['harry'], reason: 'test',
  });
  assert.equal(last.ok, false);
  const ok = decideModeration({
    actorId: 'ada', actor: 'admin', targetId: 'sam', target: null, next: 'suspended', superAdminIds: ['harry'], reason: 'Chargeback',
  });
  assert.equal(ok.ok, true);
});

test('Sparks need a reason and stay at zero or above', () => {
  assert.equal(decideSparks({ actor: 'finance', target: null, amount: 25, reason: 'Goodwill', balance: 0 }).ok, true);
  assert.equal(decideSparks({ actor: 'finance', target: null, amount: -5, reason: 'Correction', balance: 1 }).ok, false);
  assert.equal(decideSparks({ actor: 'support', target: null, amount: 10, reason: 'Help', balance: 0 }).ok, false);
  assert.equal(decideSparks({ actor: 'admin', target: 'super_admin', amount: 10, reason: 'Help', balance: 0 }).ok, false);
});

test('the directory filters and exports, and the audit log filters', () => {
  const users: DirectoryUser[] = [
    { id: '1', name: 'Ada', email: 'ada@poketschool.ai', role: 'admin', staffRole: 'admin', tier: 5, institutionId: 'school', status: 'active', country: 'MY' },
    { id: '2', name: 'Sam', email: 'sam@school.edu', role: 'student', staffRole: null, tier: 2, institutionId: 'school', status: 'suspended', country: 'GB' },
  ];
  assert.equal(filterDirectory(users, { country: 'gb', status: 'suspended' }).length, 1);
  assert.match(directoryCsv(users), /Ada/);
  const entry = auditEntry({
    actorId: 'harry', actorEmail: FIRST_SUPER_ADMIN.email, action: 'suspend', targetId: 'sam',
    before: { status: 'active' }, after: { status: 'suspended' }, at: 10,
  });
  assert.equal(filterAudit([entry], { action: 'suspend', actor: 'harry' }).length, 1);
  assert.equal(filterAudit([entry], { target: 'missing' }).length, 0);
});

test('session timeout, KPIs, and health use the supplied clock', () => {
  const now = Date.UTC(2026, 9, 15);
  assert.equal(sessionExpired(now - 31 * 60 * 1000, now), true);
  assert.equal(sessionExpired(now - 5 * 60 * 1000, now), false);
  const kpis = platformKpis({
    users: [
      { createdAt: now - 2 * 86400000, lastActiveAt: now - 86400000, status: 'active' },
      { createdAt: now - 40 * 86400000, lastActiveAt: now - 20 * 86400000, status: 'banned' },
    ],
    sparksIssued: 100, sparksSpent: 40, revenue: 79, completions: 3, openTickets: 2, now,
  });
  assert.equal(kpis.signups30, 1);
  assert.equal(kpis.active7, 1);
  assert.equal(kpis.openTickets, 2);
  assert.equal(systemHealth({ quotaErrors: 1, generationFailures: 0 }).firestore, 'attention');
  assert.equal(systemHealth({ quotaErrors: 0, generationFailures: 0 }).generation, 'ok');
});
