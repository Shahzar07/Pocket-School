import assert from 'node:assert/strict';
import test from 'node:test';
import { previewViewer } from '../allocation';
import { isFlagEnabled } from '../flags';
import { asBookProduct, decideBook, editionFor, quoteBook, searchBooks } from './books';
import { privacyBoard, publicLabel } from './privacy-board';
import { seedPricing } from '../pricing';

test('a book follows the audience policy and a purchase grant opens it', () => {
  const book = asBookProduct({
    id: 'reef',
    status: 'published',
    priceType: 'SUBSCRIPTION_INCLUDED',
    minTier: 2,
    priceUsd: 12,
    audiences: ['students'],
  });
  assert.equal(book.kind, 'book');
  assert.equal(book.contentType, 'BOOK');
  assert.equal(decideBook(book, previewViewer('student', { accessTier: 2 })).open, true);
  assert.equal(decideBook(book, previewViewer('guest')).listed, false);

  const paid = asBookProduct({
    id: 'reef',
    status: 'published',
    priceType: 'MARKETPLACE_PURCHASE',
    priceUsd: 12,
    audiences: ['marketplace'],
  });
  assert.equal(decideBook(paid, previewViewer('guest')).reason, 'Purchase required');
  assert.equal(decideBook(paid, { ...previewViewer('guest'), permissions: ['alloc:book:reef'] }).reason, 'Purchased');
});

test('a book price is quoted from USD through the shared pricing config', () => {
  const quote = quoteBook(seedPricing(), 10, 'USD');
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.amount, 10);
});

test('book translations use the lesson review model', () => {
  const book = {
    title: 'Coral',
    text: 'English source',
    localizations: {
      ms: { language: 'ms', text: 'Teks', status: 'approved' as const, source: 'ai' as const },
      zh: { language: 'zh', text: '草稿', status: 'draft' as const },
    },
  };
  assert.equal(editionFor(book, 'ms').language, 'ms');
  assert.equal(editionFor(book, 'ms').source, 'ai');
  assert.equal(editionFor(book, 'zh').fellBack, true);
  assert.equal(editionFor(book, 'en').text, 'English source');
});

test('search books matches a title and ignores a short query', () => {
  const books = [{ id: '1', title: 'Reef life', blurb: 'Fish' }];
  assert.equal(searchBooks(books, 'r').length, 0);
  assert.equal(searchBooks(books, 'reef')[0]?.id, '1');
});

test('the board hides people who opted out and shortens other names', () => {
  assert.equal(publicLabel('Ada Lovelace'), 'Ada L.');
  assert.equal(publicLabel('ada@school.test'), 'Learner');
  const rows = privacyBoard([
    { id: 'a', name: 'Ada Lovelace', score: 10, shareBoard: true },
    { id: 'b', name: 'secret@school.test', score: 50, shareBoard: false },
    { id: 'c', name: 'Bo', score: 3 },
  ], 'c');
  assert.deepEqual(rows.map(row => row.label), ['Ada L.', 'You']);
});

test('feature flags default off except the books hook and the study planner', () => {
  assert.equal(isFlagEnabled('books'), true);
  assert.equal(isFlagEnabled('studyPlanner'), true);
  assert.equal(isFlagEnabled('referral'), false);
  assert.equal(isFlagEnabled('referral', { referral: true }), true);
  assert.equal(isFlagEnabled('studyPlanner', { studyPlanner: false }), false);
});
