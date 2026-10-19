import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bookSlide,
  canFeature,
  catalogueListed,
  courseLine,
  courseSlide,
  dedupeById,
  duplicateTitleGroups,
  inFeaturedWindow,
  institutionChoices,
  mergePlan,
  moneyLabel,
  orderFeatured,
  programmePlan,
  realRating,
  yearTitleHint,
  type FeaturedSlide,
} from './placement';

function slide(partial: Partial<FeaturedSlide> & Pick<FeaturedSlide, 'id' | 'priority'>): FeaturedSlide {
  return {
    sourceId: partial.id,
    kind: 'course',
    title: partial.id,
    level: 'IGCSE',
    subject: 'Physics',
    cover: '',
    priceLabel: '$79',
    rating: null,
    ratingCount: 0,
    teacherId: 'et-physics',
    teacherName: 'ET Physics',
    teacherSrc: '/teachers/et-physics.webp',
    href: '/courses/x',
    buyHref: '/courses/x',
    enrolHref: '/courses/x',
    from: '',
    until: '',
    eligible: true,
    ...partial,
  };
}

test('featured order keeps a higher priority in front and rotates the rest by session', () => {
  const items = [
    slide({ id: 'low-a', priority: 1 }),
    slide({ id: 'top', priority: 9 }),
    slide({ id: 'low-b', priority: 1 }),
  ];
  const first = orderFeatured(items, '2026-10-19', 'alpha');
  const second = orderFeatured(items, '2026-10-19', 'alpha');
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.equal(first[0]?.id, 'top');
  assert.deepEqual(first.slice(1).map((item) => item.id).sort(), ['low-a', 'low-b']);
  const changed = ['beta', 'gamma', 'delta', 'epsilon', 'zeta'].some((key) => {
    const next = orderFeatured(items, '2026-10-19', key);
    return next[1]?.id !== first[1]?.id;
  });
  assert.equal(changed, true);
});

test('only approved published courses inside the date window are eligible', () => {
  const draft = courseSlide({
    id: 'draft', title: 'Physics', status: 'draft', ownerId: 't', type: 'course',
    placement: { marketplace: 'approved', featured: true, priority: 3 },
  });
  const hidden = courseSlide({
    id: 'hidden', title: 'Physics', status: 'published', ownerId: 't',
    placement: { marketplace: 'hidden', featured: true },
  });
  const live = courseSlide({
    id: 'live', title: 'Physics', status: 'published', ownerId: 't', price: 79,
    placement: { marketplace: 'approved', featured: true, priority: 4, featuredFrom: '2026-10-01', featuredUntil: '2026-10-31' },
  });
  const early = courseSlide({
    id: 'early', title: 'Chemistry', status: 'published', ownerId: 't',
    placement: { marketplace: 'approved', featured: true, featuredFrom: '2026-11-01' },
  });
  assert.equal(draft.eligible, false);
  assert.equal(hidden.eligible, false);
  assert.equal(canFeature('hidden'), false);
  assert.equal(canFeature('approved'), true);
  assert.equal(live.eligible, true);
  assert.equal(live.priceLabel, '$79');
  assert.equal(inFeaturedWindow(live.from, live.until, '2026-10-19'), true);
  assert.equal(inFeaturedWindow(early.from, early.until, '2026-10-19'), false);
  const ordered = orderFeatured([draft, hidden, live, early], '2026-10-19', 'alpha');
  assert.deepEqual(ordered.map((item) => item.sourceId), ['live']);
});

test('bundles and books join the same rotation with their own kind', () => {
  const bundle = courseSlide({
    id: 'pack', title: 'Science pack', status: 'published', ownerId: 't', type: 'bundle', price: 19,
    placement: { marketplace: 'approved', featured: true, priority: 2 },
  });
  const book = bookSlide({
    id: 'harbour', title: 'Harbour Notes', status: 'published', allocateMarketplace: true,
    featured: true, priority: 2, priceUsd: 4.99, readingLevel: 'igcse',
  });
  assert.equal(bundle.kind, 'bundle');
  assert.equal(book.kind, 'book');
  assert.equal(book.priceLabel, '$4.99');
  const ordered = orderFeatured([bundle, book], '2026-10-19', 'alpha');
  assert.equal(ordered.length, 2);
  assert.equal(realRating(4.5, 0), null);
  assert.deepEqual(realRating(4.5, 2), { value: 4.5, count: 2 });
  assert.equal(moneyLabel(undefined), '');
});

test('course lists dedupe by id and institutions flag a repeated school', () => {
  const courses = dedupeById([
    { id: 'a', title: 'Biology 101' },
    { id: 'a', title: 'Biology 101' },
    { id: 'b', title: 'Biology 101' },
  ]);
  assert.equal(courses.length, 2);
  assert.equal(courseLine({ ownerId: 'owner', ownerName: 'Ada', institutionName: 'North', createdOn: '2026-10-01', status: 'published' }), 'Ada · North · 2026-10-01 · published');
  const schools = institutionChoices([
    { id: 'one', name: "Rochford's International School", domain: 'rochford.edu', createdAtMs: 2 },
    { id: 'two', name: 'Rochfords International School', domain: '', createdAtMs: 1 },
    { id: 'three', name: 'North Academy', domain: 'north.edu', createdAtMs: 3 },
  ]);
  const rochford = schools.find((row) => row.duplicateIds.length > 0);
  assert.equal(rochford?.id, 'two');
  assert.deepEqual(rochford?.duplicateIds, ['one']);
  assert.equal(schools.length, 2);
});

test('year numbers suggest a level name and a merge never deletes', () => {
  assert.equal(yearTitleHint('Year 1 Law'), 'Law — Primary');
  assert.equal(yearTitleHint('Physics — Year 11'), 'Physics — IGCSE');
  assert.equal(yearTitleHint('Combined Science — Year 1'), 'Combined Science — Primary');
  assert.equal(yearTitleHint('Physics — IGCSE'), null);
  const groups = duplicateTitleGroups([
    { id: 'a', title: 'World History' },
    { id: 'b', title: 'world  history' },
    { id: 'c', title: 'Art' },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.length, 2);
  const plan = mergePlan('a', 'b');
  assert.ok(!('error' in plan));
  if ('error' in plan) return;
  assert.equal(plan.deleteCourse, false);
  assert.equal(plan.moveEnrolments, true);
  assert.equal(plan.retargetGrades, true);
  assert.ok('error' in mergePlan('a', 'a'));
});

test('programme tiles follow the student level and the catalogue respects a hidden listing', () => {
  assert.equal(programmePlan('IGCSE'), 'igcse_alevel');
  assert.equal(programmePlan('Primary'), 'primary_secondary');
  assert.equal(programmePlan('LLB'), 'professional');
  assert.equal(programmePlan(''), null);
  assert.equal(catalogueListed({}), true);
  assert.equal(catalogueListed({ placement: { marketplace: 'approved' } }), true);
  assert.equal(catalogueListed({ placement: { marketplace: 'hidden' } }), false);
});
