import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importRosterAsJoinEntry, readImportRoster } from './institution-roster';

const row = {
  email: 'Ada@School.edu.my',
  studentNumber: 'S-14',
  firstName: 'Ada',
  lastName: 'Lovelace',
  level: 'IGCSE',
  classId: 'north',
  gender: 'female',
  role: 'student',
  status: 'matched',
  matchedUid: 'uid-ada',
  importedAt: '2026-10-17T00:00:00.000Z',
  importBatchId: 'batch-1',
};

test('a roster row stores Male or Female as male or female and maps into a join match', () => {
  const parsed = readImportRoster(row);
  assert.equal('email' in parsed && parsed.email, 'ada@school.edu.my');
  assert.equal('gender' in parsed && parsed.gender, 'female');
  if ('error' in parsed) return;
  const entry = importRosterAsJoinEntry(parsed);
  assert.equal(entry.name, 'Ada Lovelace');
  assert.equal(entry.studentId, 'S-14');
  assert.equal(entry.className, 'north');
  assert.equal(entry.status, 'pending');
  assert.deepEqual(readImportRoster({ ...row, gender: 'other' }), { error: 'Gender is stored as male or female.' });
  assert.equal('error' in readImportRoster({ ...row, gender: 'Male' }), true);
  assert.equal('error' in readImportRoster({ ...row, role: 'teacher' }), true);
  assert.equal('error' in readImportRoster({ ...row, status: 'leaver' }), true);
});
