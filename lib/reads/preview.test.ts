import assert from 'node:assert/strict';
import test from 'node:test';
import { BRAND_COVER } from './cover';
import { PREVIEW } from './preview-copy';
import {
  hasChapter, pageLabel, previewPublishIssues, readerPages, readingLevelLabel, readingMinutes, readsOfferLabel,
} from './preview';

test('publish waits for a cover, alt text, and a chapter', () => {
  const open = previewPublishIssues({
    title: 'Harbour',
    blurb: 'A quiet morning.',
    ageRating: '12+',
    chapters: [{ markdown: '' }],
  });
  assert.ok(open.includes(PREVIEW.needCover));
  assert.ok(open.includes(PREVIEW.needAlt));
  assert.ok(open.includes(PREVIEW.needChapter));
  const ready = previewPublishIssues({
    title: 'Harbour',
    blurb: 'A quiet morning.',
    ageRating: '12+',
    cover: { image: 'https://example.com/cover.webp' },
    coverBrief: { artSrc: 'https://example.com/art.webp', alt: 'A blue harbour at dawn' },
    chapters: [{ markdown: 'The boats were still.' }],
  });
  assert.deepEqual(ready, []);
  assert.equal(hasChapter({ chapters: [{ markdown: '![A pier](pic.webp)' }] }), true);
});

test('the offer is the PoketReads USD price, or included when it is not sold alone', () => {
  assert.equal(readsOfferLabel({ priceUsd: 0, accessMode: 'both' }), 'Included in Reads');
  assert.equal(readsOfferLabel({ priceUsd: 1.99, accessMode: 'subscription' }), 'Included in Reads');
  assert.match(readsOfferLabel({ priceUsd: 1.99, accessMode: 'purchase' }), /1\.99/);
  assert.equal(readingLevelLabel('igcse'), 'IGCSE');
  assert.equal(readingLevelLabel('primary'), 'Primary');
  assert.equal(readingMinutes([{ markdown: '' }]), 0);
  assert.equal(readingMinutes([{ markdown: 'one two three' }]), 1);
});

test('reader pages keep chapter pictures and count from one', () => {
  const pages = readerPages([
    { order: 0, title: 'Dawn', markdown: 'The harbour was blue.\n\n![A pier](pier.webp)' },
    { order: 1, title: 'Noon', markdown: 'The market opened.' },
  ]);
  assert.ok(pages.some(page => page.markdown.includes('![A pier](pier.webp)')));
  assert.equal(pages[0]?.chapterTitle, 'Dawn');
  assert.equal(pageLabel(0, pages.length), `Page 1 of ${pages.length}`);
  assert.equal(BRAND_COVER.from, '#1E6A83');
  assert.equal(PREVIEW.fallbackMark, 'PoketSchool.Ai');
  assert.doesNotMatch(JSON.stringify(PREVIEW), /gold|mustard|#C8820A/i);
});
