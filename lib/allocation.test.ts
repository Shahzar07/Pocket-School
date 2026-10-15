import assert from 'node:assert/strict';
import test from 'node:test';
import { productAccess, previewViewer, type AllocatableProduct } from './allocation';

const course: AllocatableProduct = {
  id: 'bio',
  status: 'published',
  kind: 'curriculum',
  level: 'IGCSE',
  minTier: 2,
  priceType: 'SUBSCRIPTION_INCLUDED',
  audiences: ['students'],
};

test('a student on the plan sees and opens a student course', () => {
  const access = productAccess(course, previewViewer('student', { accessTier: 2 }));
  assert.equal(access.listed, true);
  assert.equal(access.open, true);
});

test('a guest, a teacher, a parent and another school do not see a student-only course', () => {
  for (const role of ['guest', 'teacher', 'parent', 'institution_admin'] as const) {
    const access = productAccess(course, previewViewer(role, { institutionId: 'school-b', accessTier: 5 }));
    assert.equal(access.listed, false, role);
    assert.equal(access.open, false, role);
  }
});

test('teachers see a teacher course and students do not', () => {
  const product = { ...course, audiences: ['teachers'] as const };
  assert.equal(productAccess(product, previewViewer('teacher')).listed, true);
  assert.equal(productAccess(product, previewViewer('student', { accessTier: 2 })).listed, false);
});

test('parents see a parent course', () => {
  const product = { ...course, audiences: ['parents'] as const };
  assert.equal(productAccess(product, previewViewer('parent', { accessTier: 2 })).listed, true);
  assert.equal(productAccess(product, previewViewer('student', { accessTier: 2 })).listed, false);
});

test('an institution course is limited to the selected schools', () => {
  const product: AllocatableProduct = {
    ...course,
    audiences: ['institutions'],
    priceType: 'INSTITUTION_ALLOCATED',
    allocatedInstitutionIds: ['school-a'],
  };
  const inside = productAccess(product, previewViewer('student', { institutionId: 'school-a', accessTier: 1 }));
  const outside = productAccess(product, previewViewer('student', { institutionId: 'school-b', accessTier: 2 }));
  assert.equal(inside.listed, true);
  assert.equal(inside.open, true);
  assert.equal(outside.listed, false);
  assert.equal(productAccess({ ...product, allocatedInstitutionIds: [] }, previewViewer('institution_admin')).reason, 'No institution selected');
});

test('all covers every signed-in role and leaves guests out', () => {
  const product = { ...course, audiences: ['all'] as const };
  assert.equal(productAccess(product, previewViewer('guest')).listed, false);
  assert.equal(productAccess(product, previewViewer('parent', { accessTier: 2 })).listed, true);
  assert.equal(productAccess(product, previewViewer('teacher')).listed, true);
});

test('marketplace is public and still requires purchase to open', () => {
  const product: AllocatableProduct = {
    id: 'pack',
    status: 'published',
    kind: 'marketplace',
    price: 19,
    priceType: 'MARKETPLACE_PURCHASE',
    audiences: ['marketplace'],
    isPublic: true,
  };
  const guest = productAccess(product, previewViewer('guest'));
  assert.equal(guest.listed, true);
  assert.equal(guest.open, false);
  assert.equal(guest.reason, 'Purchase required');
  const bought = productAccess(product, { ...previewViewer('student', { accessTier: 0 }), enrolled: true });
  assert.equal(bought.open, true);
});

test('a draft stays hidden unless the viewer is an admin, the owner, or already enrolled', () => {
  const draft = { ...course, status: 'draft' };
  assert.equal(productAccess(draft, previewViewer('student', { accessTier: 2 })).listed, false);
  assert.equal(productAccess(draft, previewViewer('admin')).open, true);
  assert.equal(productAccess(draft, { ...previewViewer('teacher'), isOwner: true }).open, true);
  assert.equal(productAccess(draft, { ...previewViewer('student'), enrolled: true }).open, true);
});

test('a course with no audiences keeps the older public and signed-in behaviour', () => {
  const legacy: AllocatableProduct = {
    id: 'old',
    status: 'published',
    isPublic: true,
    kind: 'marketplace',
    price: 0,
    priceType: 'FREE',
  };
  assert.equal(productAccess(legacy, previewViewer('guest')).listed, true);
  assert.equal(productAccess(legacy, previewViewer('student', { accessTier: 0 })).open, true);
});

test('a free plan cannot open a tier 2 course even when the audience matches', () => {
  const access = productAccess(course, previewViewer('student', { accessTier: 0 }));
  assert.equal(access.listed, true);
  assert.equal(access.open, false);
  assert.equal(access.reason, 'A higher plan is required');
});
