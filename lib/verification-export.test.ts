import assert from 'node:assert/strict';
import test from 'node:test';
import { filterVerifications, verificationsToCsv, type VerificationRow } from './verification-export';

const rows: VerificationRow[] = [
  { id: 'a', parentId: 'p1', parentName: 'Amina', parentEmail: 'amina@school.test', studentEmail: 'leo@school.test', studentId: 'S1', status: 'pending' },
  { id: 'b', parentId: 'p2', parentName: 'Ben', parentEmail: 'ben@school.test', studentEmail: 'mia@school.test', studentId: 'S2', status: 'approved' },
];

test('search and status filter the verification queue', () => {
  assert.equal(filterVerifications(rows, 'leo', 'all').length, 1);
  assert.equal(filterVerifications(rows, '', 'approved')[0]?.parentName, 'Ben');
  assert.equal(filterVerifications(rows, 'ben', 'pending').length, 0);
});

test('csv keeps the review fields and escapes quotes', () => {
  const csv = verificationsToCsv([{ ...rows[0]!, parentName: 'Amina "N"' }]);
  assert.match(csv, /parentName/);
  assert.match(csv, /"Amina ""N"""/);
  assert.match(csv, /leo@school.test/);
});
