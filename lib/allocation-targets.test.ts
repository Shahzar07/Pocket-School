import assert from 'node:assert/strict';
import test from 'node:test';
import { productAccess, previewViewer } from './allocation';
import {
  allocationFields,
  anyTargetMatch,
  bookFlagsFromTargets,
  describeTargets,
  migrateAllocation,
  targetsFromPolicy,
} from './allocation-targets';
import { courseWrite, applyAllocationPreset } from './course-builder';

test('a single publish scope and the book switches expand into a target list', () => {
  assert.deepEqual(migrateAllocation({ publishScope: 'marketplace' }), ['marketplace']);
  assert.deepEqual(migrateAllocation({ publishScope: 'public' }), ['all', 'marketplace']);
  assert.deepEqual(
    migrateAllocation({ publishScope: 'institution', allocatedInstitutionIds: ['school-a'] }),
    ['institutions', 'institution:school-a'],
  );
  assert.deepEqual(
    migrateAllocation({ allocateLibrary: true, allocateMarketplace: true }),
    ['students', 'parents', 'institutions', 'marketplace'],
  );
  assert.deepEqual(
    migrateAllocation({ targets: ['marketplace', 'students', 'students'] }),
    ['students', 'marketplace'],
  );
});

test('a policy with several gates becomes one target list and back again', () => {
  const targets = targetsFromPolicy({
    include: ['users', 'cohorts', 'parents', 'institutions', 'marketplace'],
    exclude: [],
    userIds: ['student-9'],
    cohortIds: ['year-8'],
    institutionIds: ['school-a'],
    institutionMode: 'specific',
  });
  assert.deepEqual(targets, [
    'parents', 'institutions', 'marketplace', 'class:year-8', 'institution:school-a', 'user:student-9',
  ]);
  const fields = allocationFields(targets, { include: [], exclude: ['teachers'] });
  assert.deepEqual(fields.accessPolicy.userIds, ['student-9']);
  assert.deepEqual(fields.accessPolicy.cohortIds, ['year-8']);
  assert.deepEqual(fields.classIds, ['year-8']);
  assert.equal(fields.accessPolicy.include.includes('parents'), true);
  assert.equal(fields.accessPolicy.include.includes('marketplace'), true);
  assert.deepEqual(fields.accessPolicy.exclude, ['teachers']);
});

test('any selected target is enough to see the item', () => {
  const targets = ['user:student-9', 'class:year-8', 'parents', 'institution:school-a', 'marketplace'];
  assert.equal(anyTargetMatch(targets, { role: 'student', userId: 'student-9' }).hit, true);
  assert.equal(anyTargetMatch(targets, { role: 'student', cohortIds: ['year-8'] }).hit, true);
  assert.equal(anyTargetMatch(targets, { role: 'parent', userId: 'someone-else' }).hit, true);
  assert.equal(anyTargetMatch(targets, { role: 'teacher', institutionId: 'school-a' }).hit, true);
  assert.equal(anyTargetMatch(targets, { role: 'guest' }).hit, true);
  const closed = ['user:student-9', 'class:year-8', 'parent:parent-2', 'institution:school-a'];
  assert.equal(anyTargetMatch(closed, { role: 'teacher', userId: 'other' }).hit, false);
  assert.equal(anyTargetMatch(closed, { role: 'parent', userId: 'parent-2' }).hit, true);
  assert.equal(anyTargetMatch(['institutions'], { role: 'student' }).reason, 'No institution selected');
  assert.equal(anyTargetMatch(['institutions'], { role: 'student', institutionId: 'school-b' }).hit, true);
});

test('the summary names every selected target in one sentence', () => {
  const sentence = describeTargets(
    ['students', 'class:year-8', 'parents', 'institution:school-a', 'marketplace'],
    { 'class:year-8': 'Year 8', 'institution:school-a': 'North Academy' },
  );
  assert.equal(sentence, 'Visible to students, Year 8, parents, North Academy, and the marketplace.');
  assert.equal(describeTargets(['user:student-demo']), 'Visible to student-demo.');
  assert.equal(describeTargets(['students', 'parents']), 'Visible to students and parents.');
});

test('a stored target list lets any matching person through', () => {
  const product = {
    id: 'mix',
    status: 'published',
    priceType: 'FREE' as const,
    targets: ['user:student-9', 'class:year-8', 'parents', 'institution:school-a'],
  };
  assert.equal(productAccess(product, { role: 'student', userId: 'student-9', accessTier: 0 }).open, true);
  assert.equal(productAccess(product, { ...previewViewer('student'), cohortIds: ['year-8'] }).listed, true);
  assert.equal(productAccess(product, previewViewer('parent')).listed, true);
  assert.equal(productAccess(product, previewViewer('student', { institutionId: 'school-a' })).listed, true);
  assert.equal(productAccess(product, previewViewer('teacher')).listed, false);
  const legacy = productAccess(
    { id: 'old-scope', status: 'published', priceType: 'FREE', publishScope: 'institution', allocatedInstitutionIds: ['school-a'] },
    previewViewer('student', { institutionId: 'school-a' }),
  );
  assert.equal(legacy.listed, true);
  assert.equal(productAccess(
    { id: 'old-scope', status: 'published', priceType: 'FREE', publishScope: 'institution', allocatedInstitutionIds: ['school-a'] },
    previewViewer('student', { institutionId: 'school-b' }),
  ).listed, false);
});

test('saving a course stores the target array beside the policy', () => {
  const fields = allocationFields(['user:student-9', 'class:year-8', 'marketplace']);
  const saved = courseWrite({
    title: 'Forces',
    description: 'A first look at forces.',
    ownerId: 'teacher-1',
    price: 19,
    policy: fields.accessPolicy,
    targets: fields.targets,
    intent: 'publish',
    role: 'teacher',
  });
  assert.deepEqual(saved.targets, ['marketplace', 'class:year-8', 'user:student-9']);
  assert.deepEqual(saved.classIds, ['year-8']);
  assert.equal(saved.status, 'pending_approval');
  const preset = applyAllocationPreset({ include: [], exclude: [] }, 'students', ['student-9']);
  const fromPreset = courseWrite({
    title: 'Forces',
    description: 'A first look at forces.',
    ownerId: 'teacher-1',
    price: 19,
    policy: preset,
    intent: 'publish',
    role: 'teacher',
  });
  assert.deepEqual(fromPreset.targets, ['user:student-9']);
  assert.deepEqual(bookFlagsFromTargets(['students', 'marketplace']), {
    allocateLibrary: true,
    allocateMarketplace: true,
  });
});
