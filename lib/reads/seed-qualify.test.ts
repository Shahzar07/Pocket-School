import assert from 'node:assert/strict';
import test from 'node:test';
import { bookSlide } from '@/lib/courses/placement';
import { hasCoverAlt, hasCoverImage, previewPublishIssues } from './preview';
import { BOOKS } from './seed';

test('published marketplace seeds have a cover, alt text, and a carousel spot', () => {
  const live = BOOKS.filter(book => book.status === 'published' && book.allocateMarketplace);
  assert.ok(live.length >= 6);
  for (const book of live) {
    assert.equal(hasCoverImage(book), true, book.id);
    assert.equal(hasCoverAlt(book), true, book.id);
    assert.equal(book.cover?.image, book.coverBrief?.artSrc, book.id);
    assert.deepEqual(previewPublishIssues(book), [], book.id);
    const slide = bookSlide({
      id: book.id,
      title: book.title,
      status: book.status,
      allocateMarketplace: book.allocateMarketplace,
      featured: book.showcase?.featured === true,
      priority: book.showcase?.priority ?? 0,
      featuredFrom: book.showcase?.from,
      featuredUntil: book.showcase?.until,
      cover: book.coverBrief?.artSrc,
      priceUsd: book.priceUsd,
      readingLevel: book.readingLevel,
    });
    assert.equal(slide.eligible, true, book.id);
    assert.equal(slide.cover, book.coverBrief?.artSrc, book.id);
  }
  const draft = BOOKS.find(book => book.id === 'monsoon-market');
  assert.ok(draft);
  const draftFeatured = draft.showcase?.featured === true;
  assert.equal(draft.status, 'draft');
  assert.equal(draft.allocateMarketplace, false);
  assert.equal(draftFeatured, false);
  assert.equal(hasCoverAlt(draft), true);
  assert.equal(bookSlide({
    id: draft.id,
    title: draft.title,
    status: draft.status,
    allocateMarketplace: draft.allocateMarketplace,
    featured: draftFeatured,
    priority: 0,
  }).eligible, false);
});
