import assert from 'node:assert/strict';
import test from 'node:test';
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

test('reading goal uses the reading category and completes at the estimate', () => {
  const goal = readingGoal({
    studentId: 'aisha',
    dateKey: '2026-10-15',
    activeSeconds: 15 * 60,
    estimateMinutes: 15,
  });
  assert.equal(goal?.category, 'reading');
  assert.equal(goal?.status, 'completed');
  assert.equal(goal?.studentId, 'aisha');
});

test('book slash command matches an id and a title', () => {
  const byId = parseBookCommand('/book harbour-light what next', BOOKS);
  assert.equal(byId?.bookId, 'harbour-light');
  assert.equal(byId?.rest, 'what next');
  assert.equal(byId?.matched, true);
  assert.equal(parseBookCommand('/book The Blue Notebook', BOOKS)?.bookId, 'blue-notebook');
  assert.equal(parseBookCommand('hello', BOOKS), null);
});

test('push body accepts a known category and rejects an unknown one', () => {
  const parsed = parsePushRequest({
    recipientUid: 'u1',
    category: 'goals',
    title: 'Reading',
    body: 'Fifteen minutes',
  });
  assert.equal('category' in parsed && parsed.category, 'goals');
  assert.deepEqual(
    parsePushRequest({ recipientUid: 'u1', category: 'reading', title: 'x', body: 'y' }),
    { error: 'category must be goals, flags, attendance, digests, grades, assignments, general, alumni, institution, achievements, network, safety, hotline, or emergency.' },
  );
});

test('adult and minor discussion rooms stay apart', () => {
  assert.equal(discussionSpace({ id: 'plain-contract', title: 'Plain Contract', ageRating: '18+' }).audience, 'adult');
  const minor = discussionSpace({ id: 'blue-notebook', title: 'The Blue Notebook', ageRating: '8+' });
  assert.equal(minor.audience, 'minor');
  assert.match(suggestWinPost({ kind: 'finish', title: minor.title, audience: minor.audience }).body, /under-18/);
});

test('finish XP is granted once', () => {
  const first = applyAward({ xp: 0, badges: [], streak: 0, finished: [] }, 'finish', 'harbour-light');
  assert.equal(first.award.xp, 50);
  assert.equal(first.award.granted, true);
  assert.ok(first.award.badges.includes('book-finished'));
  const again = applyAward(first.state, 'finish', 'harbour-light');
  assert.equal(again.award.granted, false);
  assert.equal(again.award.xp, 50);
});

test('book targets default to the allocator audiences', () => {
  assert.deepEqual(defaultBookTargets({ allocateLibrary: true, allocateMarketplace: true }), [
    'students', 'parents', 'institutions', 'marketplace',
  ]);
});

test('parent reading report rounds minutes', () => {
  assert.deepEqual(parentReadingReport({
    studentId: 'aisha',
    period: 'week',
    readingMinutes: 12.2,
    booksFinished: 1,
  }), { studentId: 'aisha', period: 'week', readingMinutes: 12, booksFinished: 1 });
});
