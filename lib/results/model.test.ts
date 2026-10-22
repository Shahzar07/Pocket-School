import assert from 'node:assert/strict';
import test from 'node:test';
import { RESULT_COPY } from './copy';
import {
  boardsMatchSharedList,
  canVerifyResult,
  degreeBandsAreNotProgrammes,
  parseDesk,
  progressBySession,
  resultsPageAllowed,
  schoolBandsUseSharedLevels,
  studentSaveStatus,
  usesSchoolBoards,
  validBoard,
} from './model';

test('school bands use the shared levels and degree bands are not programmes', () => {
  assert.equal(schoolBandsUseSharedLevels(), true);
  assert.equal(degreeBandsAreNotProgrammes(), true);
  assert.equal(boardsMatchSharedList(), true);
  assert.equal(usesSchoolBoards('IGCSE'), true);
  assert.equal(usesSchoolBoards('Degree'), false);
});

test('IGCSE boards come from the shared list and degree bodies are entered', () => {
  assert.equal(validBoard('IGCSE', 'Cambridge International'), true);
  assert.equal(validBoard('A-Level', 'Pearson Edexcel'), true);
  assert.equal(validBoard('IGCSE', 'A university'), false);
  assert.equal(validBoard('Masters', 'A university'), true);
  assert.equal(validBoard('PhD', ''), false);
});

test('the disclaimer is exact and a learner cannot verify themselves', () => {
  assert.equal(RESULT_COPY.disclaimer, 'Exam boards award these grades. Poket School records them.');
  assert.equal(RESULT_COPY.disclaimer.includes('Poket School awards'), false);
  assert.equal(studentSaveStatus('verified'), 'self-reported');
  assert.equal(studentSaveStatus('self-reported'), 'self-reported');
  assert.equal(RESULT_COPY.verified, 'Verified by the school');
});

test('teachers stay out, and a school verifies only its own learner', () => {
  assert.equal(resultsPageAllowed({ role: 'student' }), true);
  assert.equal(resultsPageAllowed({ role: 'parent' }), true);
  assert.equal(resultsPageAllowed({ role: 'admin' }), true);
  assert.equal(resultsPageAllowed({ role: 'institution_admin' }), true);
  assert.equal(resultsPageAllowed({ role: 'teacher', roles: ['student', 'teacher'] }), false);
  assert.equal(canVerifyResult({ role: 'student' }, { institutionId: 'school-a' }), false);
  assert.equal(canVerifyResult({ role: 'parent' }, { institutionId: 'school-a' }), false);
  assert.equal(canVerifyResult({ role: 'teacher' }, { institutionId: 'school-a' }), false);
  assert.equal(canVerifyResult({ role: 'admin' }, {}), true);
  assert.equal(canVerifyResult({ role: 'institution_admin', institutionId: 'school-a' }, { institutionId: 'school-a' }), true);
  assert.equal(canVerifyResult({ role: 'institution_admin', institutionId: 'school-a' }, { institutionId: 'school-b' }), false);
  assert.equal(canVerifyResult({ role: 'institution_admin', institutionId: '' }, { institutionId: 'school-a' }), false);
});

test('sessions list subjects and grades without a score', () => {
  const progress = progressBySession([
    { session: 'Oct/Nov 2025', subject: 'English', grade: 'B', level: 'IGCSE', createdAt: 2 },
    { session: 'May/June 2026', subject: 'Mathematics', grade: 'A*', level: 'IGCSE', createdAt: 3 },
    { session: 'May/June 2026', subject: 'Physics', grade: 'A', level: 'IGCSE', createdAt: 4 },
  ]);
  assert.deepEqual(progress.map((group) => group.session), ['Oct/Nov 2025', 'May/June 2026']);
  assert.equal(progress[1]?.entries.length, 2);
  assert.equal(JSON.stringify(progress).includes('%'), false);
  assert.equal(JSON.stringify(progress).includes('storagePath'), false);
});

test('a parsed desk drops a storage path', () => {
  const desk = parseDesk({
    role: 'student',
    canEdit: true,
    rows: [{ id: 'row-1', subject: 'Mathematics', status: 'self-reported', storagePath: 'results/secret' }],
    share: { enabled: false, path: '' },
  });
  assert.equal(desk.rows[0]?.subject, 'Mathematics');
  assert.equal(Object.prototype.hasOwnProperty.call(desk.rows[0], 'storagePath'), false);
  assert.equal(desk.share?.enabled, false);
});
