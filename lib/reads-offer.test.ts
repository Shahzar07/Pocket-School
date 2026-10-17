import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readsOfferExcerpts } from './reads-offer-excerpts';
import { LANGUAGES } from './languages';
import { READS_BOOKS, READS_PLANS } from './payments/reads';
import {
  READS_OFFER_CHECKOUTS,
  READS_OFFER_FAQ,
  READS_OFFER_FOUNDER,
  READS_OFFER_LANGUAGE_COUNT,
  READS_OFFER_TESTIMONIALS,
  bookCheckoutHref,
  readsCheckoutHref,
  readsMonthlyUsd,
  readsOfferJsonLd,
  readsYearlyUsd,
} from './reads-offer';

test('Reads prices match the shelf and the ten-month year', () => {
  assert.equal(readsMonthlyUsd('reads'), 9);
  assert.equal(readsYearlyUsd('reads'), 90);
  assert.equal(readsMonthlyUsd('reads-family'), 15);
  assert.equal(readsYearlyUsd('reads-family'), 150);
  assert.equal(READS_PLANS.find(plan => plan.id === 'reads')?.usd, 9);
  assert.deepEqual(
    READS_OFFER_CHECKOUTS.map(item => item.usd),
    [9, 90, 15, 150],
  );
});

test('checkout links use the unified Reads checkout', () => {
  assert.equal(readsCheckoutHref('reads', 'month'), '/dashboard/checkout?kind=reads&sku=reads&interval=month');
  assert.equal(readsCheckoutHref('reads', 'year'), '/dashboard/checkout?kind=reads&sku=reads&interval=year');
  assert.equal(readsCheckoutHref('reads-family', 'month'), '/dashboard/checkout?kind=reads&sku=reads-family&interval=month');
  assert.equal(bookCheckoutHref('harbour-light'), '/dashboard/checkout?kind=book&sku=harbour-light');
});

test('buy-to-own prices are the published shelf prices', () => {
  const harbour = READS_BOOKS.find(book => book.id === 'harbour-light');
  assert.equal(harbour?.usd, 5);
  assert.equal(harbour?.title, 'The Harbour Light');
});

test('excerpts are the opening of real seed chapters', () => {
  const excerpts = readsOfferExcerpts();
  const harbour = excerpts.find(item => item.id === 'harbour-light');
  const cells = excerpts.find(item => item.id === 'cells-to-systems');
  const contract = excerpts.find(item => item.id === 'plain-contract');
  const yellow = excerpts.find(item => item.id === 'yellow-window');
  assert.match(harbour?.paragraphs[0] ?? '', /The jetty smelled of rain/);
  assert.match(cells?.paragraphs[0] ?? '', /cell/i);
  assert.match(contract?.paragraphs[0] ?? '', /contract/i);
  assert.match(yellow?.paragraphs.join(' ') ?? '', /yellow raincoat/);
  assert.equal(excerpts.filter(item => item.lane === 'academic').length, 3);
  assert.equal(excerpts.filter(item => item.lane === 'story').length, 3);
});

test('language count follows the catalogue, and the letter does not invent social proof', () => {
  assert.equal(READS_OFFER_LANGUAGE_COUNT, LANGUAGES.length);
  assert.equal(LANGUAGES.length, 53);
  const blob = JSON.stringify(readsOfferJsonLd());
  assert.equal(blob.includes('aggregateRating'), false);
  assert.equal(blob.includes('reviewCount'), false);
  assert.equal(blob.includes('ratingValue'), false);
  assert.match(blob, /"@type":"FAQPage"/);
  assert.match(blob, /"price":"9.00"/);
  assert.match(blob, /"price":"150.00"/);
});

test('the letter has a founder note and no invented reviews, guarantee or bonus', () => {
  assert.equal(READS_OFFER_TESTIMONIALS.length, 0);
  assert.equal(READS_OFFER_FOUNDER.name, 'Harry Seggu');
  assert.match(READS_OFFER_FOUNDER.paragraphs[0], /^I am Harry Seggu/);
  const faqBlob = READS_OFFER_FAQ.map(item => `${item.question} ${item.answer}`).join(' ');
  const founderBlob = READS_OFFER_FOUNDER.paragraphs.join(' ');
  assert.equal(/guarantee/i.test(faqBlob), false);
  assert.equal(/bonus/i.test(faqBlob), false);
  assert.equal(/guarantee/i.test(founderBlob), false);
  assert.equal(/bonus/i.test(founderBlob), false);
  assert.equal(/30-day/i.test(faqBlob), false);
  assert.equal(/thousand/i.test(faqBlob), false);
  const json = JSON.stringify(readsOfferJsonLd());
  assert.equal(json.includes('"@type":"Review"'), false);
  assert.equal(json.includes('aggregateRating'), false);
});
