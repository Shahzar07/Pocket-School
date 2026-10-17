import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HOST_LOGIN_SLUG,
  INSTITUTION_ADMIN_CODE_UNAVAILABLE,
  PLATFORM_LOGIN_URL,
  belongsToInstitution,
  decideInstitutionLogin,
  institutionLoginLinks,
  institutionLoginRefusal,
  institutionLoginRewrite,
  isBrandedLoginPath,
} from './institution-login';

describe('institution login routing', () => {
  it('rewrites an academy /login and leaves the platform doors alone', () => {
    assert.equal(institutionLoginRewrite('poketschool.ai', '/login'), null);
    assert.equal(institutionLoginRewrite('www.poketschool.ai', '/login'), null);
    assert.equal(institutionLoginRewrite('north.poketschool.ai', '/admin/login'), null);
    assert.equal(institutionLoginRewrite('north.poketschool.ai', '/courses'), null);
    assert.equal(institutionLoginRewrite('preview.vercel.app', '/login'), null);
    assert.equal(institutionLoginRewrite('north.poketschool.ai', '/login'), '/i/north/login');
    assert.equal(institutionLoginRewrite('north.poketschool.ai', '/login/'), '/i/north/login');
    assert.equal(institutionLoginRewrite('www.poketschool.ai', '/a/north/login'), '/i/north/login');
    assert.equal(institutionLoginRewrite('learn.north.example', '/login'), `/i/${HOST_LOGIN_SLUG}/login`);
    assert.equal(institutionLoginRewrite('north.localhost:3000', '/login'), '/i/north/login');
  });

  it('recognises the branded login paths', () => {
    assert.equal(isBrandedLoginPath('/login'), true);
    assert.equal(isBrandedLoginPath('/i/north/login'), true);
    assert.equal(isBrandedLoginPath(`/i/${HOST_LOGIN_SLUG}/login`), true);
    assert.equal(isBrandedLoginPath('/a/north/login'), true);
    assert.equal(isBrandedLoginPath('/preview/institution-login'), true);
    assert.equal(isBrandedLoginPath('/admin/login'), false);
    assert.equal(isBrandedLoginPath('/a/north'), false);
  });

  it('prefers the custom domain, then the subdomain, then the apex path', () => {
    assert.deepEqual(institutionLoginLinks({ slug: 'north', customDomain: 'https://learn.north.example/extra' }), {
      share: 'https://learn.north.example/login',
      direct: 'https://poketschool.ai/i/north/login',
    });
    assert.deepEqual(institutionLoginLinks({ slug: 'North', customDomain: 'north.poketschool.ai' }), {
      share: 'https://north.poketschool.ai/login',
      direct: 'https://poketschool.ai/i/north/login',
    });
    assert.deepEqual(institutionLoginLinks({ slug: '' }), { share: '', direct: '' });
  });
});

describe('who may use an institution login', () => {
  const school = 'school-a';

  it('sends members to their dashboard and keeps other schools out', () => {
    assert.deepEqual(
      decideInstitutionLogin({ role: 'student', institutionId: school }, school, { tab: 'student' }),
      { allowed: true, destination: '/dashboard/student', needsEmailCode: false, mode: 'student' },
    );
    assert.deepEqual(
      decideInstitutionLogin({ role: 'teacher', institutionId: school }, school, { tab: 'teacher' }),
      { allowed: true, destination: '/dashboard/teacher', needsEmailCode: false, mode: 'teacher' },
    );
    assert.deepEqual(
      decideInstitutionLogin({ role: 'teacher', institutionId: school }, school, { tab: 'student' }),
      { allowed: true, destination: '/dashboard/student', needsEmailCode: false, mode: 'student' },
    );
    assert.deepEqual(
      decideInstitutionLogin({ role: 'parent', institutionId: school }, school),
      { allowed: true, destination: '/dashboard/parent', needsEmailCode: false, mode: 'parent' },
    );
    assert.equal(decideInstitutionLogin({ role: 'student', institutionId: 'other' }, school).allowed, false);
    assert.equal(decideInstitutionLogin({ role: 'student', memberOf: [school] }, school).allowed, true);
    assert.equal(belongsToInstitution({ institutionId: school }, school), true);
    assert.match(institutionLoginRefusal('North Academy'), /North Academy/);
    assert.equal(PLATFORM_LOGIN_URL, 'https://poketschool.ai/login');
  });

  it('requires an email code for this academy\'s admins and refuses platform staff', () => {
    assert.deepEqual(
      decideInstitutionLogin(
        { role: 'institution_admin', institutionId: school },
        school,
        { tab: 'student' },
      ),
      { allowed: true, destination: '/dashboard/institution', needsEmailCode: true, mode: null },
    );
    assert.equal(
      decideInstitutionLogin({ role: 'admin', institutionId: school }, school, { platformStaff: true }).allowed,
      false,
    );
    assert.equal(
      decideInstitutionLogin({ role: 'teacher', institutionId: school }, school, { platformStaff: true }).allowed,
      false,
    );
    assert.match(INSTITUTION_ADMIN_CODE_UNAVAILABLE, /stops here/);
  });
});
