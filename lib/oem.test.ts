import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brandedInvite, certificateBrandLine, licencePhase, makeJoinCode,
  normaliseCustomDomain, parseInviteCsv, programmeLicensed, seatsRemaining,
  type OemLicence,
} from './oem';

const licence: OemLicence = {
  institutionId: 'school-a',
  programmeIds: ['lower-secondary'],
  seats: 30,
  seatsUsed: 30,
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  currency: 'USD',
  amount: 990,
  allowOwnCourses: true,
  status: 'active',
};

test('a licence moves from pending to active to full to expired', () => {
  assert.equal(licencePhase({ ...licence, seatsUsed: 1 }, '2025-12-31'), 'pending');
  assert.equal(licencePhase({ ...licence, seatsUsed: 1 }, '2026-06-01'), 'active');
  assert.equal(licencePhase(licence, '2026-06-01'), 'full');
  assert.equal(licencePhase(licence, '2027-01-01'), 'expired');
  assert.equal(licencePhase({ ...licence, status: 'suspended' }, '2026-06-01'), 'suspended');
});

test('only a live licence unlocks its programmes', () => {
  assert.equal(programmeLicensed(licence, 'lower-secondary', '2026-06-01'), true);
  assert.equal(programmeLicensed(licence, 'llb', '2026-06-01'), false);
  assert.equal(programmeLicensed(licence, 'lower-secondary', '2027-01-01'), false);
  assert.equal(seatsRemaining({ seats: 30, seatsUsed: 28 }), 2);
});

test('a CSV invite keeps students and teachers and reports bad rows', () => {
  const parsed = parseInviteCsv('email,name,role\nAda@School.edu,Ada Lovelace,teacher\nbea@school.edu,Bea,\nnot-an-email,No,student\n');
  assert.deepEqual(parsed.rows, [
    { email: 'ada@school.edu', name: 'Ada Lovelace', role: 'teacher' },
    { email: 'bea@school.edu', name: 'Bea', role: 'student' },
  ]);
  assert.equal(parsed.errors.length, 1);
});

test('join codes and branded messages use the academy name', () => {
  assert.equal(makeJoinCode(() => 0), 'AAAAAAAA');
  const mail = brandedInvite({ displayName: 'Kolej Utama', emailFromName: 'Kolej Office' }, 'ABCD2345', 'https://kolej.example');
  assert.match(mail.subject, /Kolej Utama/);
  assert.match(mail.text, /ABCD2345/);
  assert.equal(certificateBrandLine({ displayName: 'Kolej Utama', certificateIssuer: 'Kolej Utama Academy' }), 'Kolej Utama Academy');
  assert.equal(normaliseCustomDomain('https://learn.kolej.example/path'), 'learn.kolej.example');
  assert.equal(normaliseCustomDomain('kolej.poketschool.ai'), null);
});
