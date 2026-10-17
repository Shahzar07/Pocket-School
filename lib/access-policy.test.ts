import assert from 'node:assert/strict';
import test from 'node:test';
import { productAccess, previewViewer, type AllocatableProduct } from './allocation';
import {
  describeAccess,
  lessonWindow,
  normalisePolicy,
  parseAllocationCsv,
  type AccessPolicy,
} from './access-policy';

const now = '2026-10-15';

function product(policy: AccessPolicy, extra: Partial<AllocatableProduct> = {}): AllocatableProduct {
  return {
    id: 'bio',
    status: 'published',
    kind: 'curriculum',
    level: 'IGCSE',
    minTier: 2,
    priceType: 'SUBSCRIPTION_INCLUDED',
    accessPolicy: policy,
    ...extra,
  };
}

const base: AccessPolicy = { include: ['students'], exclude: [] };

test('marketplace can be excluded without hiding an included role', () => {
  const item = product({ include: ['students', 'marketplace'], exclude: ['marketplace'] });
  assert.equal(productAccess(item, { ...previewViewer('guest'), now }).listed, false);
  assert.equal(productAccess(item, { ...previewViewer('student', { accessTier: 2 }), now }).open, true);
});

test('students are included and other roles are not', () => {
  const item = product(base);
  assert.equal(productAccess(item, previewViewer('student', { accessTier: 2 })).open, true);
  for (const role of ['guest', 'teacher', 'parent'] as const) {
    assert.equal(productAccess(item, { ...previewViewer(role, { accessTier: 5 }), now }).listed, false, role);
  }
});

test('teachers, parents, and every signed-in person are separate audiences', () => {
  assert.equal(productAccess(product({ include: ['teachers'], exclude: [] }), previewViewer('teacher')).listed, true);
  assert.equal(productAccess(product({ include: ['teachers'], exclude: [] }), previewViewer('student', { accessTier: 2 })).listed, false);
  assert.equal(productAccess(product({ include: ['parents'], exclude: [] }), previewViewer('parent', { accessTier: 2 })).listed, true);
  const everyone = product({ include: ['all'], exclude: [] });
  assert.equal(productAccess(everyone, previewViewer('guest')).listed, false);
  assert.equal(productAccess(everyone, previewViewer('teacher')).listed, true);
});

test('institutions can be one school or every school', () => {
  const specific = product({
    include: ['institutions'],
    exclude: [],
    institutionMode: 'specific',
    institutionIds: ['school-a'],
  }, { priceType: 'INSTITUTION_ALLOCATED' });
  const inside = previewViewer('student', { institutionId: 'school-a', accessTier: 1 });
  const outside = previewViewer('student', { institutionId: 'school-b', accessTier: 2 });
  assert.equal(productAccess(specific, inside).open, true);
  assert.equal(productAccess(specific, outside).listed, false);
  assert.equal(productAccess(product({ include: ['institutions'], exclude: [], institutionMode: 'specific' }), previewViewer('student')).reason, 'No institution selected');

  const anySchool = product({ include: ['institutions'], exclude: [], institutionMode: 'all' });
  assert.equal(productAccess(anySchool, previewViewer('teacher', { institutionId: 'school-b' })).listed, true);
  assert.equal(productAccess(anySchool, previewViewer('teacher')).listed, false);
});

test('individual users and cohorts can be included or excluded', () => {
  const named = product({ include: ['users'], exclude: [], userIds: ['ada'] });
  assert.equal(productAccess(named, { ...previewViewer('student', { accessTier: 2 }), userId: 'ada', now }).listed, true);
  assert.equal(productAccess(named, { ...previewViewer('student', { accessTier: 2 }), userId: 'grace', now }).listed, false);

  const classroom = product({ include: ['cohorts'], exclude: [], cohortIds: ['class-1'] });
  assert.equal(productAccess(classroom, { ...previewViewer('student', { accessTier: 2 }), cohortIds: ['class-1'], now }).listed, true);
  assert.equal(productAccess(classroom, { ...previewViewer('student', { accessTier: 2 }), cohortIds: ['class-2'], now }).listed, false);

  const hidden = product({ include: ['students'], exclude: ['teachers'], excludeUserIds: ['ada'] });
  assert.equal(productAccess(hidden, { ...previewViewer('student', { accessTier: 2 }), userId: 'ada', now }).reason, 'Excluded');
  assert.equal(productAccess(hidden, previewViewer('teacher')).reason, 'Excluded');
  assert.equal(productAccess(hidden, { ...previewViewer('student', { accessTier: 2 }), userId: 'grace', now }).open, true);
});

test('marketplace stays public and a purchase, coupon, bundle, or trial opens it', () => {
  const item = product({ include: ['marketplace'], exclude: [] }, { priceType: 'MARKETPLACE_PURCHASE', price: 19 });
  assert.equal(productAccess(item, { ...previewViewer('guest'), now }).reason, 'Purchase required');
  const bought = productAccess(item, { ...previewViewer('student', { accessTier: 0 }), permissions: ['alloc:marketplace:bio'], now });
  assert.equal(bought.open, true);
  const coupon = productAccess(item, { ...previewViewer('student', { accessTier: 0 }), couponCourseIds: ['bio'], now });
  assert.equal(coupon.reason, 'Coupon');
  const bundle = productAccess(
    product({ include: ['marketplace'], exclude: [], bundleIds: ['pack'] }, { priceType: 'MARKETPLACE_PURCHASE' }),
    { ...previewViewer('guest'), bundleIds: ['pack'], now },
  );
  assert.equal(bundle.reason, 'Included in a bundle');
  const trial = productAccess(
    product({ include: ['students'], exclude: [], trialDays: 7 }, { priceType: 'MARKETPLACE_PURCHASE' }),
    { ...previewViewer('student', { accessTier: 0 }), enrolled: true, trial: true, enrolledOn: '2026-10-14', now },
  );
  assert.equal(trial.reason, 'Trial');
  const ended = productAccess(
    product({ include: ['students'], exclude: [], trialDays: 7 }, { priceType: 'MARKETPLACE_PURCHASE' }),
    { ...previewViewer('student', { accessTier: 0 }), enrolled: true, trial: true, enrolledOn: '2026-10-01', now },
  );
  assert.equal(ended.reason, 'Trial ended');
});

test('sparks unlock, plan tier, and free preview lessons', () => {
  const sparks = product({ include: ['students'], exclude: [], sparksCost: 40 }, { priceType: 'SPARKS_UNLOCK' });
  assert.equal(productAccess(sparks, { ...previewViewer('student', { accessTier: 2 }), now }).reason, 'Unlock with Sparks');
  assert.equal(productAccess(sparks, { ...previewViewer('student', { accessTier: 2 }), sparksUnlocked: true, now }).open, true);
  const gated = productAccess(product(base), previewViewer('student', { accessTier: 0 }));
  assert.equal(gated.reason, 'A higher plan is required');
  const preview = lessonWindow({ ...base, freePreviewCount: 1 }, previewViewer('guest'), 0, 0);
  assert.equal(preview.reason, 'Free preview');
  assert.equal(lessonWindow({ ...base, freePreviewCount: 1 }, previewViewer('guest'), 2, 0).open, false);
});

test('programme, year, level, country, region, and language narrow the audience', () => {
  const aimed = product({
    ...base,
    programmeIds: ['lower-secondary'],
    yearGroups: ['Year 8'],
    levels: ['IGCSE'],
    countries: ['MY'],
    regions: ['Selangor'],
    languages: ['ms', 'en'],
  });
  const match = {
    ...previewViewer('student', { accessTier: 2 }),
    programmeId: 'lower-secondary',
    yearGroup: 'Year 8',
    level: 'IGCSE',
    country: 'my',
    region: 'Selangor',
    language: 'ms',
    now,
  };
  assert.equal(productAccess(aimed, match).open, true);
  assert.equal(productAccess(aimed, { ...match, country: 'GB' }).reason, 'Outside this country');
  assert.equal(productAccess(aimed, { ...match, language: 'zh' }).reason, 'Not available in this language');
  assert.equal(productAccess(aimed, { ...match, yearGroup: 'Year 9' }).reason, 'Outside this level');
});

test('release, expiry, access length, drip, and seats', () => {
  const scheduled = product({ ...base, releaseOn: '2026-11-01' });
  assert.equal(productAccess(scheduled, { ...previewViewer('student', { accessTier: 2 }), now }).reason, 'Releases 2026-11-01');
  const expired = product({ ...base, expiresOn: '2026-10-01' });
  assert.equal(productAccess(expired, { ...previewViewer('student', { accessTier: 2 }), enrolled: true, now }).reason, 'Access ended');
  const limited = product({ ...base, accessDays: 30 });
  assert.equal(productAccess(limited, {
    ...previewViewer('student', { accessTier: 2 }),
    enrolled: true,
    enrolledOn: '2026-09-01',
    now,
  }).reason, 'Access ended');
  const drip = lessonWindow(
    { ...base, dripMode: 'lesson', dripEveryDays: 7 },
    { ...previewViewer('student'), enrolled: true, enrolledOn: '2026-10-15', now },
    2,
    0,
  );
  assert.equal(drip.reason, 'Opens 2026-10-29');
  const full = product({ ...base, seatLimit: 1, seatsUsed: 1 });
  assert.equal(productAccess(full, { ...previewViewer('student', { accessTier: 2 }), now }).reason, 'No seats left');
  assert.equal(productAccess(full, { ...previewViewer('student', { accessTier: 2 }), enrolled: true, now }).open, true);
});

test('the summary and the CSV name who is granted and who is revoked', () => {
  const summary = describeAccess(product({
    include: ['students', 'institutions'],
    exclude: ['parents'],
    institutionMode: 'specific',
    institutionIds: ['school-a'],
    seatLimit: 40,
    seatsUsed: 3,
  }));
  assert.match(summary, /Students/);
  assert.match(summary, /Hidden from Parents/);
  assert.match(summary, /3\/40 seats/);
  const parsed = parseAllocationCsv('email,action\nAda@School.test,grant\nbad-row,grant\nlee@school.test,revoke\n');
  assert.deepEqual(parsed.rows, [
    { id: 'ada@school.test', action: 'grant' },
    { id: 'lee@school.test', action: 'revoke' },
  ]);
  assert.equal(parsed.errors.length, 1);
});

test('a saved policy leaves the seat counter to enrolment', () => {
  const saved = normalisePolicy({ include: ['students'], exclude: [], seatLimit: 10, seatsUsed: 4 });
  assert.equal(saved.seatLimit, 10);
  assert.equal('seatsUsed' in saved, false);
});
