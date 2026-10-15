import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAllocationPreset,
  awaitsMarketplaceReview,
  courseWrite,
  instructorSnapshot,
  moveStudioLecture,
  moveStudioSection,
  omitUndefined,
  publishDecision,
  teacherMayWriteCourse,
  type StudioSection,
} from './course-builder';

test('course create drops undefined optional fields and keeps the title', () => {
  const modal = omitUndefined({
    title: 'Cell respiration',
    description: 'How cells release energy.',
    ownerId: 'teacher-1',
    ownerName: undefined,
    thumbnailUrl: undefined,
    subject: undefined,
    workbookUrl: undefined,
    previewUrl: undefined,
    durationHours: undefined,
    price: 0,
    currency: 'USD',
    whatYouLearn: ['ATP'],
    nested: { keep: 'yes', drop: undefined },
  });
  assert.equal(modal.title, 'Cell respiration');
  assert.equal(modal.ownerId, 'teacher-1');
  assert.equal(modal.price, 0);
  assert.equal('ownerName' in modal, false);
  assert.equal('thumbnailUrl' in modal, false);
  assert.equal('previewUrl' in modal, false);
  assert.equal('durationHours' in modal, false);
  assert.deepEqual(modal.nested, { keep: 'yes' });
  assert.equal(JSON.stringify(modal).includes('undefined'), false);
});

test('allocating a course to a student publishes it without listing it', () => {
  const policy = applyAllocationPreset({ include: [], exclude: [] }, 'students', ['student-9']);
  const saved = courseWrite({
    title: 'Forces',
    description: 'A first look at forces.',
    ownerId: 'teacher-1',
    ownerName: undefined,
    thumbnailUrl: undefined,
    price: 19,
    free: false,
    policy,
    intent: 'publish',
    role: 'teacher',
  });
  assert.equal(saved.status, 'published');
  assert.equal(saved.isPublic, false);
  assert.equal(saved.currency, 'USD');
  assert.deepEqual((saved.accessPolicy as { include: string[]; userIds: string[] }).include, ['users']);
  assert.deepEqual((saved.accessPolicy as { userIds: string[] }).userIds, ['student-9']);
  assert.equal('ownerName' in saved, false);
  assert.equal('thumbnailUrl' in saved, false);
  assert.equal(teacherMayWriteCourse({
    actorRole: 'teacher',
    actorId: 'teacher-1',
    ownerId: 'teacher-1',
    nextOwnerId: 'teacher-1',
    next: { status: 'published', isPublic: false, include: ['users'] },
  }), true);
});

test('a teacher marketplace listing waits for admin approval', () => {
  const policy = applyAllocationPreset({ include: [], exclude: [] }, 'marketplace');
  const saved = courseWrite({
    title: 'Forces',
    description: 'A first look at forces.',
    ownerId: 'teacher-1',
    price: 0,
    free: true,
    policy,
    intent: 'publish',
    role: 'teacher',
  });
  assert.equal(saved.status, 'pending_approval');
  assert.equal(saved.isPublic, false);
  assert.equal(saved.price, 0);
  assert.equal(saved.priceType, 'FREE');
  assert.equal(includesMarketplace(saved), true);
  assert.equal(teacherMayWriteCourse({
    actorRole: 'teacher',
    actorId: 'teacher-1',
    ownerId: 'teacher-1',
    nextOwnerId: 'teacher-1',
    next: { status: 'published', isPublic: true, include: ['marketplace'] },
  }), false);
  assert.deepEqual(publishDecision({ intent: 'publish', policy, role: 'admin' }), {
    status: 'published',
    isPublic: true,
  });
});

function includesMarketplace(saved: Record<string, unknown>): boolean {
  const policy = saved.accessPolicy as { include?: string[] };
  return !!policy.include?.includes('marketplace');
}

test('a teacher cannot edit someone else\'s course or take ownership', () => {
  assert.equal(teacherMayWriteCourse({
    actorRole: 'teacher',
    actorId: 'teacher-2',
    ownerId: 'teacher-1',
    nextOwnerId: 'teacher-1',
    next: { status: 'draft' },
  }), false);
  assert.equal(teacherMayWriteCourse({
    actorRole: 'teacher',
    actorId: 'teacher-1',
    ownerId: 'teacher-1',
    nextOwnerId: 'teacher-2',
    next: { status: 'draft' },
  }), false);
  assert.equal(teacherMayWriteCourse({
    actorRole: 'admin',
    actorId: 'admin-1',
    ownerId: 'teacher-1',
    nextOwnerId: 'teacher-1',
    next: { status: 'published', isPublic: true, include: ['marketplace'] },
  }), true);
});

test('draft stays off the marketplace and older products still use review', () => {
  const decision = publishDecision({
    intent: 'draft',
    policy: applyAllocationPreset({ include: [], exclude: [] }, 'marketplace'),
    role: 'teacher',
  });
  assert.deepEqual(decision, { status: 'draft', isPublic: false });
  assert.equal(awaitsMarketplaceReview({}), true);
  assert.equal(awaitsMarketplaceReview({ accessPolicy: { include: ['users'] } }), false);
  assert.equal(awaitsMarketplaceReview({ accessPolicy: { include: ['marketplace'] } }), true);
});

test('sections and lectures reorder and the instructor totals add up', () => {
  const sections: StudioSection[] = [
    { id: 's1', title: 'One', lectures: [{ id: 'l1', title: 'A', kind: 'lecture', body: '' }, { id: 'l2', title: 'B', kind: 'quiz', body: '' }] },
    { id: 's2', title: 'Two', lectures: [] },
  ];
  assert.deepEqual(moveStudioSection(sections, 's2', 's1').map(section => section.id), ['s2', 's1']);
  assert.deepEqual(moveStudioLecture(sections, 's1', 'l2', 'l1')[0].lectures.map(lecture => lecture.id), ['l2', 'l1']);
  const totals = instructorSnapshot({
    courses: [{ enrollmentCount: 4, revenueTotal: 19 }, { enrollmentCount: 1, revenueTotal: 0 }],
    reviews: [{ rating: 5 }, { rating: 4 }, { rating: 0 }],
    questions: [{ reply: '' }, { reply: 'See lesson 2' }],
  });
  assert.equal(totals.enrollments, 5);
  assert.equal(totals.revenue, 19);
  assert.equal(totals.average, 4.5);
  assert.equal(totals.reviewCount, 2);
  assert.equal(totals.openQuestions, 1);
  assert.equal(totals.questionCount, 2);
});
