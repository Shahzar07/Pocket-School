import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryAllowed, holderAddress, parseAddresses, recipientList, smtpConfigured, SMTP_MISSING } from './delivery';

test('mail addresses and role limits', () => {
  assert.equal(smtpConfigured({ host: 'smtp.resend.com', user: 'resend', pass: 'secret' }), true);
  assert.equal(smtpConfigured({ host: 'smtp.resend.com' }), false);
  const parsed = parseAddresses('Parent@school.test, parent@school.test');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.emails, ['parent@school.test']);
  assert.deepEqual(recipientList(['Holder@school.test'], true, ['office@school.test']), ['holder@school.test', 'office@school.test']);
  assert.equal(deliveryAllowed({ role: 'parent', actorId: 'p', childIds: ['c1'], studentIds: ['c1'] }).ok, true);
  assert.equal(deliveryAllowed({ role: 'parent', actorId: 'p', childIds: ['c1'], studentIds: ['other'] }).ok, false);
  assert.equal(deliveryAllowed({ role: 'teacher', actorId: 't', taughtStudentIds: [], studentIds: ['t'] }).ok, true);
  assert.equal(deliveryAllowed({ role: 'teacher', actorId: 't', taughtStudentIds: ['s1'], studentIds: ['s1'] }).ok, true);
  assert.equal(deliveryAllowed({ role: 'teacher', actorId: 't', taughtStudentIds: ['s1'], studentIds: ['s2'] }).ok, false);
  assert.equal(deliveryAllowed({ role: 'student', actorId: 's', studentIds: ['s'] }).ok, true);
  assert.equal(deliveryAllowed({ role: 'admin', actorId: 'a', studentIds: [] }).ok, true);
  assert.equal(deliveryAllowed({
    role: 'institution_admin', actorId: 'i', actorInstitutionId: 'north', documentInstitutionId: 'north', studentIds: [],
  }).ok, true);
  assert.match(SMTP_MISSING, /Download PDF still works/);
  assert.equal(holderAddress({ holderEmail: 'Parent@school.test', studentId: 'c1' }, () => 'child@school.test'), 'Parent@school.test');
  assert.equal(holderAddress({ studentId: 'c1' }, (id) => id === 'c1' ? 'child@school.test' : undefined), 'child@school.test');
});
