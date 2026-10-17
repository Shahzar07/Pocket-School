import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeEducation, keepStudentNumber, openEducation, rememberClosed, spanDates } from './lifelong';

test('the same student number follows the learner and earlier academies stay', () => {
  assert.equal(keepStudentNumber(' ps-abcd-2345 ', 'PS-OTHER-9999'), 'PS-ABCD-2345');
  const first = openEducation([], {
    institutionId: 'north',
    institutionName: 'North Academy',
    level: 'IGCSE',
    studentNumber: 'ps-abcd-2345',
  }, '2022-09-01');
  const both = openEducation(first, {
    institutionId: 'harbour',
    institutionName: 'Harbour College',
    level: 'A-Level',
    studentNumber: 'PS-OTHER-9999',
  }, '2024-09-01');
  assert.equal(both.length, 2);
  assert.deepEqual(both.map((span) => span.studentNumber), ['PS-ABCD-2345', 'PS-ABCD-2345']);
  const north = both.find((span) => span.institutionId === 'north');
  const harbour = both.find((span) => span.institutionId === 'harbour');
  assert.equal(north?.from, '2022-09-01');
  assert.equal(north?.to, '2024-09-01');
  assert.equal(harbour?.to, '');
  assert.equal(spanDates(harbour!), '2024-09-01 – present');
  const closed = closeEducation(both, 'harbour', '2026-06-01');
  assert.equal(closed.find((span) => span.institutionId === 'harbour')?.to, '2026-06-01');
  assert.equal(closed.length, 2);
});

test('a finished academy is remembered without closing the academy that is still open', () => {
  const open = openEducation([], {
    institutionId: 'harbour',
    institutionName: 'Harbour College',
    level: 'A-Level',
    studentNumber: 'PS-ABCD-2345',
  }, '2024-09-01');
  const remembered = rememberClosed(open, {
    institutionId: 'north',
    institutionName: 'North Academy',
    level: 'IGCSE',
    studentNumber: 'PS-OTHER-9999',
  }, '2024-09-01');
  assert.equal(remembered.length, 2);
  assert.equal(remembered.find((span) => span.institutionId === 'harbour')?.to, '');
  assert.equal(remembered.find((span) => span.institutionId === 'north')?.to, '2024-09-01');
  assert.equal(remembered[0]?.studentNumber, 'PS-ABCD-2345');
});
