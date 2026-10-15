import { describe, expect, it } from 'vitest';
import { countCompleted, isPublishedLesson, progressPercent, splitLessons } from './progress';

describe('progress', () => {
  const lessons = [
    { id: 'a', status: 'published' },
    { id: 'b', status: 'draft' },
    { id: 'c' },
  ];

  it('treats a missing status as published', () => {
    expect(isPublishedLesson({ id: 'c' })).toBe(true);
    expect(isPublishedLesson({ id: 'b', status: 'draft' })).toBe(false);
  });

  it('uses the same published list for the catalogue and the percentage', () => {
    const split = splitLessons(lessons, 'curriculum');
    expect(split.published.map((l) => l.id)).toEqual(['a', 'c']);
    expect(split.upcoming.map((l) => l.id)).toEqual(['b']);
    expect(progressPercent(countCompleted(['a'], split.published), split.published.length)).toBe(50);
  });

  it('does not count a draft toward the percentage', () => {
    const split = splitLessons(lessons, 'curriculum');
    expect(progressPercent(countCompleted(['b'], split.published), split.published.length)).toBe(0);
  });

  it('is zero for an empty course', () => {
    expect(progressPercent(3, 0)).toBe(0);
  });
});
