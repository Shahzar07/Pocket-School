import { describe, expect, it } from 'vitest';
import { applyAward } from './gamification';
import { readingGoal } from './reading';
import { parsePushRequest } from './push';
import { discussionSpace, suggestWinPost } from './community';
import { parseBookCommand } from './studio-commands';
import { defaultBookTargets } from './allocation';
import { parentReadingReport } from './reports';

const BOOKS = [
  { id: 'harbour-light', title: 'Harbour Light' },
  { id: 'blue-notebook', title: 'The Blue Notebook' },
];

describe('reading goals', () => {
  it('uses the reading category and completes at the estimate', () => {
    const goal = readingGoal({
      studentId: 'aisha',
      dateKey: '2026-10-15',
      activeSeconds: 15 * 60,
      estimateMinutes: 15,
    });
    expect(goal?.category).toBe('reading');
    expect(goal?.status).toBe('completed');
    expect(goal?.studentId).toBe('aisha');
  });
});

describe('book slash command', () => {
  it('matches an id and a title', () => {
    expect(parseBookCommand('/book harbour-light what next', BOOKS)).toMatchObject({
      bookId: 'harbour-light',
      rest: 'what next',
      matched: true,
    });
    expect(parseBookCommand('/book The Blue Notebook', BOOKS)?.bookId).toBe('blue-notebook');
    expect(parseBookCommand('hello', BOOKS)).toBeNull();
  });
});

describe('shared adapters', () => {
  it('validates a push body and rejects a missing category', () => {
    expect(parsePushRequest({
      recipientUid: 'u1',
      category: 'goals',
      title: 'Reading',
      body: 'Fifteen minutes',
    })).toMatchObject({ category: 'goals' });
    expect(parsePushRequest({ recipientUid: 'u1', category: 'reading', title: 'x', body: 'y' })).toEqual({
      error: 'category must be goals, flags, attendance, digests, grades, assignments, or general.',
    });
  });

  it('keeps adult and minor discussion rooms apart', () => {
    expect(discussionSpace({ id: 'plain-contract', title: 'Plain Contract', ageRating: '18+' }).audience).toBe('adult');
    const minor = discussionSpace({ id: 'blue-notebook', title: 'The Blue Notebook', ageRating: '8+' });
    expect(minor.audience).toBe('minor');
    expect(suggestWinPost({ kind: 'finish', title: minor.title, audience: minor.audience }).body).toContain('under-18');
  });

  it('grants finish XP once', () => {
    const first = applyAward({ xp: 0, badges: [], streak: 0, finished: [] }, 'finish', 'harbour-light');
    expect(first.award).toMatchObject({ xp: 50, granted: true, badges: ['book-finished'] });
    const again = applyAward(first.state, 'finish', 'harbour-light');
    expect(again.award.granted).toBe(false);
    expect(again.award.xp).toBe(50);
  });

  it('defaults book targets to the allocator audiences', () => {
    expect(defaultBookTargets({ allocateLibrary: true, allocateMarketplace: true })).toEqual([
      'students', 'parents', 'institutions', 'marketplace',
    ]);
  });

  it('shapes a parent reading report', () => {
    expect(parentReadingReport({
      studentId: 'aisha',
      period: 'week',
      readingMinutes: 12.2,
      booksFinished: 1,
    })).toEqual({ studentId: 'aisha', period: 'week', readingMinutes: 12, booksFinished: 1 });
  });
});
