import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminFromVerifiedIdentity, roleForServerCheck, sessionClaimsFromVerified } from './admin-access';

describe('admin role from a verified ID token', () => {
  it('accepts an admin claim and a staff claim', () => {
    assert.equal(adminFromVerifiedIdentity({ role: 'admin', profileRole: 'parent' }), true);
    assert.equal(adminFromVerifiedIdentity({ adminRole: 'content_editor', role: 'admin' }), true);
    assert.equal(adminFromVerifiedIdentity({ email: 'harry@poketschool.ai', role: 'parent' }), true);
  });

  it('does not let a parent claim or a request body become admin', () => {
    assert.equal(adminFromVerifiedIdentity({ role: 'parent', profileRole: 'admin' }), false);
    assert.equal(adminFromVerifiedIdentity({ role: 'teacher', profileRole: 'admin' }), false);
    assert.equal(adminFromVerifiedIdentity({ role: 'student' }), false);
    assert.equal(adminFromVerifiedIdentity({ profileRole: 'parent' }), false);
  });

  it('uses the server profile only when the token has no role claim', () => {
    assert.equal(adminFromVerifiedIdentity({ role: '', profileRole: 'admin' }), true);
    assert.equal(adminFromVerifiedIdentity({ profileRole: 'admin' }), true);
    assert.equal(adminFromVerifiedIdentity({ role: '', profileRole: 'parent' }), false);
  });

  it('keeps a parent token from inheriting an admin profile', () => {
    assert.equal(roleForServerCheck({ role: 'parent' }, 'admin'), 'parent');
    assert.equal(roleForServerCheck({ role: 'teacher' }, 'admin'), 'teacher');
    assert.equal(roleForServerCheck({ role: 'student' }, 'institution_admin'), 'student');
    assert.equal(roleForServerCheck({}, 'admin'), 'admin');
    assert.equal(roleForServerCheck({ role: 'admin' }, 'parent'), 'admin');
    const session = sessionClaimsFromVerified({
      tokenRole: 'parent',
      profileRole: 'admin',
      profileAdminRole: 'super_admin',
      profileRoles: ['admin', 'parent', 'student'],
    });
    assert.equal(session.role, 'parent');
    assert.equal(session.adminRole, '');
    assert.deepEqual(session.roles, ['parent', 'student']);
    assert.equal(sessionClaimsFromVerified({ profileRole: 'admin', profileAdminRole: 'admin' }).role, 'admin');
  });
});
