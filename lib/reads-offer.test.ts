import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { CYAN, light } from './design/tokens';
import { FOOTER_COLUMNS } from './marketing/footer-columns';
import { MARKET_LINKS } from './marketing/nav';
import { BANNED_OFFER_COLOURS, OFFER_JACKETS } from './reads-offer-media';
import { readsOfferExcerpts } from './reads-offer-excerpts';
import { LANGUAGES } from './languages';
import { BOOKS } from './reads/seed';
import { READS_BOOKS, readsPlanItem } from './payments/reads';
import { seedPricing } from './pricing';
import {
  READS_BOOK_USD,
  READS_OFFER_BOOKS,
  READS_OFFER_CHECKOUTS,
  READS_OFFER_FAQ,
  READS_OFFER_FOUNDER,
  READS_OFFER_LANGUAGE_COUNT,
  READS_OFFER_TESTIMONIALS,
  bookCheckoutHref,
  booksDearerThanUnlimited,
  booksVersusUnlimitedLine,
  ownOrReadLine,
  readsCheckoutHref,
  readsMonthlyUsd,
  readsOfferIndexable,
  readsOfferJsonLd,
  readsYearlyUsd,
} from './reads-offer';

test('Reads prices match the shared shelf', () => {
  assert.equal(readsMonthlyUsd('reads'), readsPlanItem('reads', 'month')?.unitAmount);
  assert.equal(readsYearlyUsd('reads'), readsPlanItem('reads', 'year')?.unitAmount);
  assert.equal(readsMonthlyUsd('reads'), 4.99);
  assert.equal(readsYearlyUsd('reads'), 49.99);
  assert.equal(readsMonthlyUsd('reads-family'), 7.99);
  assert.equal(readsYearlyUsd('reads-family'), 79.99);
  assert.equal(readsPlanItem('reads', 'year')?.unitAmount, 49.99);
  assert.notEqual(readsYearlyUsd('reads'), readsMonthlyUsd('reads') * 10);
  assert.notEqual(readsYearlyUsd('reads-family'), readsMonthlyUsd('reads-family') * 10);
  assert.deepEqual(
    READS_OFFER_CHECKOUTS.map(item => item.usd),
    [4.99, 49.99, 7.99, 79.99],
  );
});

test('checkout links use the unified Reads checkout', () => {
  assert.equal(readsCheckoutHref('reads', 'month'), '/dashboard/checkout?kind=reads&sku=reads&interval=month');
  assert.equal(readsCheckoutHref('reads', 'year'), '/dashboard/checkout?kind=reads&sku=reads&interval=year');
  assert.equal(readsCheckoutHref('reads-family', 'month'), '/dashboard/checkout?kind=reads&sku=reads-family&interval=month');
  assert.equal(bookCheckoutHref('harbour-light'), '/dashboard/checkout?kind=book&sku=harbour-light');
});

test('buy-to-own prices come from the shared shelf', () => {
  const config = seedPricing();
  const harbour = READS_BOOKS.find(book => book.id === 'harbour-light');
  const harbourSeed = BOOKS.find(book => book.id === 'harbour-light');
  assert.equal(READS_BOOK_USD, config.defaultBookUsd);
  assert.equal(READS_BOOK_USD, 1.99);
  assert.equal(harbour?.usd, config.defaultBookUsd);
  assert.equal(harbourSeed?.priceUsd, config.defaultBookUsd);
  assert.equal(harbour?.title, 'The Harbour Light');
  assert.deepEqual(
    READS_OFFER_BOOKS.map(book => [book.id, book.usd]),
    READS_BOOKS.map(book => [book.id, book.usd]),
  );
  assert.equal(booksDearerThanUnlimited(), 3);
  assert.equal(3 * READS_BOOK_USD > readsMonthlyUsd('reads'), true);
  assert.equal(2 * READS_BOOK_USD > readsMonthlyUsd('reads'), false);
  assert.equal(ownOrReadLine(), 'Own a book at the shelf price of $1.99, or read everything for $4.99/month');
  assert.equal(booksVersusUnlimitedLine(), 'Three books at the shelf price cost more than a month of unlimited');
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
  assert.match(blob, /"price":"4.99"/);
  assert.match(blob, /"price":"49.99"/);
  assert.match(blob, /"price":"7.99"/);
  assert.match(blob, /"price":"79.99"/);
  assert.match(blob, /"price":"1.99"/);
  assert.equal(blob.includes('"price":"9.00"'), false);
  assert.equal(blob.includes('"price":"150.00"'), false);
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
  assert.equal(/ten times/i.test(faqBlob), false);
  assert.equal(/two months/i.test(faqBlob), false);
  assert.equal(/ten times/i.test(founderBlob), false);
  assert.equal(/two months/i.test(founderBlob), false);
  assert.match(faqBlob, /\$1\.99/);
  assert.match(faqBlob, /\$4\.99/);
  assert.match(faqBlob, /\$49\.99/);
  assert.match(faqBlob, /\$7\.99/);
  assert.match(faqBlob, /\$79\.99/);
  assert.match(founderBlob, /1\.99 US dollars/);
  assert.match(founderBlob, /A title that stores its own price uses that figure/);
  assert.match(founderBlob, /Three books at the shelf price cost more than a month of unlimited/);
  const json = JSON.stringify(readsOfferJsonLd());
  assert.equal(json.includes('"@type":"Review"'), false);
  assert.equal(json.includes('aggregateRating'), false);
});

test('sales-letter jackets use Poket blue and electric cyan', () => {
  const used = JSON.stringify(OFFER_JACKETS).toUpperCase();
  for (const colour of BANNED_OFFER_COLOURS) {
    assert.equal(used.includes(colour), false);
  }
  assert.match(used, new RegExp(light.blueDeep, 'i'));
  assert.match(used, new RegExp(light.primary, 'i'));
  assert.match(used, new RegExp(light.blueBright, 'i'));
  assert.match(used, new RegExp(CYAN.fill, 'i'));
  assert.equal(used.includes(CYAN.strong.toUpperCase()), false);
  const letter = readFileSync(new URL('../components/reads-offer/cta.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../components/offer/offer-landing.tsx', import.meta.url), 'utf8');
  assert.match(letter, /var\(--ps-cyan\)/);
  assert.match(letter, /var\(--ps-cyan-ink\)/);
  assert.match(letter, /var\(--ps-cyan-border\)/);
  assert.match(card, /var\(--ps-cyan\)/);
  assert.match(card, /var\(--ps-cyan-ink\)/);
  assert.equal(/#3FE0D0|#14B8A6|#E2AF4D|#1F8A70|#1A3C34|#C8922A/i.test(letter + card), false);
  const offerLetter = readFileSync(new URL('../components/reads-offer/letter.tsx', import.meta.url), 'utf8');
  assert.equal(MARKET_LINKS.some(link => link.href === '/reads/offer' && link.label === 'Poket Reads'), true);
  assert.equal(FOOTER_COLUMNS.some(column => column.links.some(link => link.href === '/reads/offer')), true);
  const chrome = readFileSync(new URL('../components/app-chrome.tsx', import.meta.url), 'utf8');
  assert.match(chrome, /ThemeProvider/);
  assert.match(chrome, /pathname === '\/reads\/offer'/);
  assert.match(offerLetter, /ReadsOfferThemeToggle/);
});

test('the sales letter stays out of search until READS_OFFER_INDEXABLE is true', () => {
  const previous = process.env.READS_OFFER_INDEXABLE;
  try {
    delete process.env.READS_OFFER_INDEXABLE;
    assert.equal(readsOfferIndexable(), false);
    process.env.READS_OFFER_INDEXABLE = 'false';
    assert.equal(readsOfferIndexable(), false);
    process.env.READS_OFFER_INDEXABLE = '1';
    assert.equal(readsOfferIndexable(), false);
    process.env.READS_OFFER_INDEXABLE = 'true';
    assert.equal(readsOfferIndexable(), true);
  } finally {
    if (previous === undefined) delete process.env.READS_OFFER_INDEXABLE;
    else process.env.READS_OFFER_INDEXABLE = previous;
  }

  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  const robots = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/reads/offer/page.tsx', import.meta.url), 'utf8');
  for (const source of [sitemap, robots, page]) assert.match(source, /readsOfferIndexable/);
  assert.match(sitemap, /path: '\/reads\/offer'/);
  assert.match(sitemap, /route\.path !== READS_OFFER_PATH/);
  assert.match(robots, /READS_OFFER_PATH/);
  assert.match(page, /index: indexable/);
  assert.match(page, /follow: indexable/);
  assert.match(page, /canonical: READS_OFFER_PATH/);
  assert.match(page, /\/reads\/offer\/og\.jpg/);
});
