import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideAlumniClaim,
  emailDomainMatches,
  readAlumniClaim,
  rosterCountsForAlumni,
  validGraduationYear,
} from './alumni-claim';

test('a roster or email domain match joins a registered academy without a queue', () => {
  assert.equal(rosterCountsForAlumni({ role: 'student', status: 'joined' }), true);
  assert.equal(rosterCountsForAlumni({ role: 'student', status: 'leaver' }), false);
  assert.equal(rosterCountsForAlumni({ role: 'parent', status: 'joined' }), false);
  assert.equal(emailDomainMatches('ada@school.edu.my', ['school.edu.my']), true);
  assert.equal(emailDomainMatches('ada@gmail.com', ['@school.edu.my']), false);
  assert.deepEqual(decideAlumniClaim({
    registered: true,
    rosterMatch: true,
    domainMatch: false,
    ageTier: 'adult',
    parentApproved: false,
  }), { status: 'verified', method: 'roster' });
  assert.deepEqual(decideAlumniClaim({
    registered: true,
    rosterMatch: false,
    domainMatch: true,
    ageTier: 'adult',
    parentApproved: false,
  }), { status: 'verified', method: 'domain' });
});

test('everyone else at a registered academy waits, and an unlisted school stays unverified', () => {
  assert.deepEqual(decideAlumniClaim({
    registered: true,
    rosterMatch: false,
    domainMatch: false,
    ageTier: 'adult',
    parentApproved: false,
  }), { status: 'pending', method: 'admin' });
  assert.deepEqual(decideAlumniClaim({
    registered: false,
    rosterMatch: false,
    domainMatch: false,
    ageTier: 'adult',
    parentApproved: false,
  }), { status: 'unverified', method: 'peer' });
});

test('a minor waits for a parent before any alumni network opens', () => {
  assert.deepEqual(decideAlumniClaim({
    registered: true,
    rosterMatch: true,
    domainMatch: true,
    ageTier: 'teen',
    parentApproved: false,
  }), { status: 'needs_parent', method: '' });
  assert.deepEqual(decideAlumniClaim({
    registered: false,
    rosterMatch: false,
    domainMatch: false,
    ageTier: 'under13',
    parentApproved: true,
  }), { status: 'unverified', method: 'peer' });
  assert.equal(validGraduationYear('2020', 2026), true);
  assert.equal(validGraduationYear('1890', 2026), false);
  const fields = readAlumniClaim({
    schoolName: 'North Academy',
    graduationYear: '2024',
    className: 'Willow',
    country: 'my',
    state: 'Penang',
    todayYear: 2026,
  });
  assert.equal('error' in fields, false);
  if (!('error' in fields)) assert.equal(fields.country, 'MY');
  const missing = readAlumniClaim({ schoolName: 'North', graduationYear: '2024', className: '', todayYear: 2026 });
  assert.equal('error' in missing && missing.error, 'Enter the class.');
});
