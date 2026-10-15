import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countCompleted, isPublishedLesson, progressPercent, splitLessons } from './progress';

describe('progress', () => {
  const lessons = [
    { id: 'a', status: 'published' },
    { id: 'b', status: 'draft' },
    { id: 'c' },
  ];

  it('treats a missing status as published', () => {
    assert.equal(isPublishedLesson({ id: 'c' }), true);
    assert.equal(isPublishedLesson({ id: 'b', status: 'draft' }), false);
  });

  it('uses the same published list for the catalogue and the percentage', () => {
    const split = splitLessons(lessons, 'curriculum');
    assert.deepEqual(split.published.map((l) => l.id), ['a', 'c']);
    assert.deepEqual(split.upcoming.map((l) => l.id), ['b']);
    assert.equal(progressPercent(countCompleted(['a'], split.published), split.published.length), 50);
  });

  it('does not count a draft toward the percentage', () => {
    const split = splitLessons(lessons, 'curriculum');
    assert.equal(progressPercent(countCompleted(['b'], split.published), split.published.length), 0);
  });

  it('is zero for an empty course', () => {
    assert.equal(progressPercent(3, 0), 0);
  });
});
