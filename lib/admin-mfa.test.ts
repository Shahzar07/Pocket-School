import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseEmailAllowlist,
  parseFallbackFactors,
  smtpFallbackFactors,
  staffRoleForMfa,
} from './admin-mfa';

test('the env allowlist is trimmed, lowercased, and deduped', () => {
  assert.deepEqual(
    parseEmailAllowlist(' Harry.Seggu@gmail.com, harry.seggu@gmail.com, not-an-email, ,ada@poketschool.ai '),
    ['harry.seggu@gmail.com', 'ada@poketschool.ai'],
  );
  assert.deepEqual(parseEmailAllowlist(undefined), []);
  assert.deepEqual(parseEmailAllowlist(''), []);
});

test('smtp fallback is only for an allowlisted super admin', () => {
  const allowlist = ['harry.seggu@gmail.com'];
  assert.deepEqual(
    smtpFallbackFactors({
      email: 'Harry.Seggu@gmail.com',
      allowlist,
      staffRole: 'super_admin',
    }),
    ['google', 'totp'],
  );
  assert.deepEqual(
    smtpFallbackFactors({
      email: 'harry.seggu@gmail.com',
      allowlist: [],
      staffRole: 'super_admin',
    }),
    [],
  );
  assert.deepEqual(
    smtpFallbackFactors({
      email: 'ada@poketschool.ai',
      allowlist: ['ada@poketschool.ai'],
      staffRole: 'admin',
    }),
    [],
  );
  assert.deepEqual(
    smtpFallbackFactors({
      email: 'sam@school.edu',
      allowlist: ['sam@school.edu'],
      staffRole: null,
    }),
    [],
  );
});

test('a seeded owner is a super admin even before a custom claim exists', () => {
  assert.equal(staffRoleForMfa({ email: 'harry.seggu@gmail.com', role: 'teacher' }), 'super_admin');
  assert.equal(
    staffRoleForMfa({ email: 'ada@poketschool.ai', role: 'admin', adminRole: 'admin' }),
    'admin',
  );
  assert.equal(
    staffRoleForMfa({ email: 'ada@poketschool.ai', adminRole: 'super_admin' }),
    'super_admin',
  );
});

test('fallback factors from the server are ignored unless they are google or totp', () => {
  assert.deepEqual(parseFallbackFactors(['google', 'totp', 'skip', 'email']), ['google', 'totp']);
  assert.deepEqual(parseFallbackFactors('google'), []);
  assert.deepEqual(parseFallbackFactors(undefined), []);
});
