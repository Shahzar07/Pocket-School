import assert from 'node:assert/strict';
import test from 'node:test';
import { averageRating, filterCatalog, recommend, recordStudyDay, resumeTarget, streakFromDates, toggleBookmark } from './learning';

const catalog = [
  { id: 'bio', title: 'Biology', description: 'Cells', subject: 'Science', level: 'IGCSE', price: 20, tags: ['cells'] },
  { id: 'chem', title: 'Chemistry', description: 'Atoms', subject: 'Science', level: 'IGCSE', price: 40 },
  { id: 'math', title: 'Maths', description: 'Algebra', subject: 'Maths', level: 'Primary', price: 10 },
];

test('search filters by words, subject, level and price', () => {
  assert.deepEqual(filterCatalog(catalog, { q: 'cells' }).map(item => item.id), ['bio']);
  assert.deepEqual(filterCatalog(catalog, { subject: 'Science', level: 'igcse', maxPrice: 25 }).map(item => item.id), ['bio']);
});

test('recommendations stay on the same subject', () => {
  assert.deepEqual(recommend(catalog, catalog[0]).map(item => item.id), ['chem']);
});

test('ratings average and streaks count consecutive days', () => {
  assert.equal(averageRating([5, 4, 4]), 4.3);
  assert.equal(averageRating([]), null);
  assert.deepEqual(streakFromDates(['2026-10-13', '2026-10-14', '2026-10-15'], '2026-10-15'), { current: 3, longest: 3 });
  assert.deepEqual(streakFromDates(['2026-10-13', '2026-10-14'], '2026-10-15'), { current: 2, longest: 2 });
  assert.equal(streakFromDates(['2026-10-01'], '2026-10-15').current, 0);
  assert.deepEqual(recordStudyDay(['2026-10-14'], '2026-10-15'), ['2026-10-14', '2026-10-15']);
});

test('resume prefers the last opened lesson, then the first unfinished one', () => {
  const lessons = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  assert.equal(resumeTarget(lessons, ['a'], 'b')?.id, 'b');
  assert.equal(resumeTarget(lessons, ['a'], null)?.id, 'b');
  assert.deepEqual(toggleBookmark(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleBookmark(['a', 'b'], 'b'), ['a']);
});
