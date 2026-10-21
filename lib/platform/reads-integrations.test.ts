import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAward } from './gamification';
import { readingGoal } from './reading';
import { deliverReadingGoal, parsePushRequest } from './push';
import { discussionSpace, suggestWinPost } from './community';
import { parseBookCommand } from './studio-commands';
import { defaultBookTargets } from './allocation';
import { parentReadingReport } from './reports';
import { quotePrice } from './pricing';
import type { PushMessage } from '../push';

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
    { error: 'category must be goals, flags, attendance, digests, grades, assignments, general, progress, alumni, institution, achievements, network, safety, hotline, admin, or emergency.' },
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
  assert.deepEqual(
    defaultBookTargets({ targets: ['marketplace', 'teachers'], allocateLibrary: true }),
    ['teachers', 'marketplace'],
  );
});

test('a shelf price uses the admin MYR rate', () => {
  const quote = quotePrice(5, 'USD', 'MYR');
  assert.equal(quote.usd, 5);
  assert.equal(quote.localAmount, 23.99);
  assert.equal(quote.localCurrency, 'MYR');
  assert.equal(quote.asOf, 'admin');
  assert.equal(quotePrice(0, 'USD', 'MYR').combined, 'Free');
});

test('a reading notice is delivered as a goals push', async () => {
  const sent: PushMessage[] = [];
  const report = await deliverReadingGoal({
    recipientUid: 'parent-1',
    category: 'general',
    title: 'Continue',
    body: '40% of the way through',
    link: '/reads/read/harbour-light',
  }, {
    store: {
      async listForUser() {
        return [{
          userId: 'parent-1',
          token: 't',
          platform: 'web',
          provider: 'webpush',
          deviceId: 'd1',
        }];
      },
      async deleteToken() {},
    },
    send: async (_token, message) => {
      sent.push(message);
      return { ok: true, prune: false };
    },
  });
  assert.equal(report.category, 'goals');
  assert.equal(report.sent, 1);
  assert.equal(sent[0]?.category, 'goals');
  assert.equal(sent[0]?.link, '/reads/read/harbour-light');
});

test('parent reading report rounds minutes', () => {
  assert.deepEqual(parentReadingReport({
    studentId: 'aisha',
    period: 'week',
    readingMinutes: 12.2,
    booksFinished: 1,
  }), { studentId: 'aisha', period: 'week', readingMinutes: 12, booksFinished: 1 });
});
