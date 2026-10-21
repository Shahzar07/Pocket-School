import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signDashboardSession, verifyDashboardSession } from './dashboard-session';
import {
  ACCESS_DENIED_MESSAGE,
  decideDashboardAccess,
  isRoleRestricted,
  safeDashboardNext,
} from './dashboard-access';

const parent = { role: 'parent', email: 'qa.parent@poketschool.ai', roles: ['student', 'parent'] };
const student = { role: 'student', email: 'student@poketschool.ai' };
const teacher = { role: 'teacher', email: 'teacher@poketschool.ai', roles: ['student', 'teacher'] };
const admin = { role: 'admin', email: 'ada@poketschool.ai', adminRole: 'admin' };
const superAdmin = { role: 'admin', email: 'ada@poketschool.ai', adminRole: 'super_admin' };
const school = { role: 'institution_admin', email: 'school@poketschool.ai', institutionId: 'school-a' };

describe('dashboard role guard', () => {
  it('sends a parent away from the admin course catalogue', () => {
    const decision = decideDashboardAccess('/dashboard/admin/courses', parent, 'parent');
    assert.equal(decision.allowed, false);
    if (!decision.allowed) {
      assert.equal(decision.status, 403);
      assert.equal(decision.redirectTo, '/dashboard/parent?notice=403');
    }
    assert.equal(ACCESS_DENIED_MESSAGE.length > 0, true);
  });

  it('blocks student and teacher shells the account does not hold', () => {
    assert.equal(decideDashboardAccess('/dashboard/teacher/courses', parent, 'parent').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/parent', student, 'student').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/student/courses', student, 'student').allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/teacher/gradebook', teacher, 'teacher').allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/institution', teacher, 'teacher').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/partner', student, 'student').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/partner', { role: 'partner_merchant' }).allowed, true);
  });

  it('keeps platform admin pages to platform admins and the audit log to super admins', () => {
    assert.equal(decideDashboardAccess('/dashboard/admin/books', admin).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/books', { role: 'admin', adminRole: 'content_editor' }).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/books', { ...teacher, cms: true }).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/books', teacher).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/courses', admin).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/payments', admin).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/finance', parent, 'parent').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/activity', admin).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/audit', admin).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/activity', superAdmin).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/courses', school).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/institutions/school-a', school).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/institution/certificates', school).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/allocations', school).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/allocations', teacher).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/certificates', school).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/partners', { role: 'partner_merchant' }).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/partners', teacher).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/help', school).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/help', parent, 'parent').allowed, false);
  });

  it('keeps the exam pack desk to platform admins', () => {
    assert.equal(decideDashboardAccess('/dashboard/admin/exam-packs', admin).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/exam-packs', student).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/exam-packs', teacher).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/exam-packs', school).allowed, false);
  });

  it('opens curriculum only for an admin or a teacher with the CMS add-on', () => {
    assert.equal(decideDashboardAccess('/dashboard/admin/curriculum', teacher).allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/curriculum/course-1', {
      ...teacher,
      permissions: ['addon:cms'],
    }).allowed, true);
    assert.equal(decideDashboardAccess('/dashboard/admin/curriculum', parent, 'parent').allowed, false);
    assert.equal(decideDashboardAccess('/dashboard/admin/courses', {
      ...teacher,
      cms: true,
    }).allowed, false);
  });

  it('leaves shared pages open and rejects off-site next hops', () => {
    assert.equal(isRoleRestricted('/dashboard/profile'), false);
    assert.equal(isRoleRestricted('/dashboard/messages'), false);
    assert.equal(isRoleRestricted('/dashboard/admin/courses'), true);
    assert.equal(decideDashboardAccess('/dashboard/studio', parent, 'parent').allowed, true);
    assert.equal(safeDashboardNext('/dashboard/admin/courses'), '/dashboard/admin/courses');
    assert.equal(safeDashboardNext('https://evil.example/dashboard/admin'), '/dashboard/student');
    assert.equal(safeDashboardNext('//evil.example'), '/dashboard/student');
  });
});

describe('dashboard session cookie', () => {
  it('rejects a tampered role claim', async () => {
    process.env.DASHBOARD_SESSION_SECRET = 'test-dashboard-session-secret';
    const token = await signDashboardSession({
      uid: 'parent1',
      email: 'qa.parent@poketschool.ai',
      role: 'parent',
      roles: ['parent'],
      trusted: true,
    });
    assert.ok(token);
    const session = await verifyDashboardSession(token!);
    assert.equal(session?.role, 'parent');
    assert.equal(decideDashboardAccess('/dashboard/admin/courses', session ?? {}).allowed, false);

    const parts = token!.split('.');
    const body = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as { role: string };
    body.role = 'admin';
    parts[1] = Buffer.from(JSON.stringify(body)).toString('base64url');
    assert.equal(await verifyDashboardSession(parts.join('.')), null);
  });
});
