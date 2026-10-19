import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { SAMPLE_POSTS, featuredPost, filterPosts, isAffiliateToken, isPublic, renderRss, slugify } from './posts';
import { AFFILIATE_REL } from './posts';

const SLUGS = [
  'igcse-revision-with-et-ai',
  'support-learning-at-home-parents-guide',
  'how-schools-use-poket-school',
  'make-it-stick-review',
  'mindset-carol-dweck-review',
  'read-aloud-handbook-review',
];

test('editorial drafts stay unpublished', () => {
  assert.deepEqual(SAMPLE_POSTS.map((post) => post.slug), SLUGS);
  for (const post of SAMPLE_POSTS) {
    assert.equal(post.status, 'draft');
    assert.equal(post.sample, true);
    assert.equal(isPublic(post, Date.now()), false);
    assert.equal(post.body.includes('<!--'), false);
    assert.equal(post.body.includes('Editorial notes'), false);
    assert.equal(post.coverImage, `/blog/${post.slug}.webp`);
    assert.equal(post.thumbnail, `/blog/thumbs/${post.slug}.webp`);
    assert.equal((post.coverAlt || '').length >= 2, true);
    assert.equal(readFileSync(`public${post.coverImage}`).length < 160_000, true);
    assert.equal(readFileSync(`public${post.thumbnail}`).length > 500, true);
    assert.equal(/Udemy|Coursera|\bPocket\b/i.test(`${post.title}\n${post.body}`), false);
  }
  const reviews = SAMPLE_POSTS.filter((post) => post.category === 'Book Reviews');
  assert.equal(reviews.length, 3);
  for (const post of reviews) {
    assert.equal(post.affiliate, true);
    const tokens = post.body.match(/\[SHOPEE_AFFILIATE_LINK:[^\]]+\]/g) ?? [];
    assert.equal(tokens.length >= 2, true);
    for (const token of tokens) assert.equal(isAffiliateToken(token), true);
  }
  assert.equal(SAMPLE_POSTS.filter((post) => post.category === 'Learning').length, 1);
  assert.equal(SAMPLE_POSTS.filter((post) => post.category === 'Families').length, 1);
  assert.equal(SAMPLE_POSTS.filter((post) => post.category === 'Schools').length, 1);
});

test('a scheduled post waits, then a published one is listed', () => {
  const base = { ...SAMPLE_POSTS[0], sample: false, status: 'scheduled' as const, publishedAt: 5_000 };
  assert.equal(isPublic(base, 4_000), false);
  assert.equal(isPublic({ ...base, publishedAt: null }, 9_000), false);
  assert.equal(isPublic({ ...base, publishedAt: 5_000 }, 5_000), true);
  assert.equal(isPublic({ ...base, status: 'draft', publishedAt: 1 }, 9_000), false);
  const live = { ...base, status: 'published' as const, featured: true, title: 'Live essay', category: 'ET AI' };
  assert.equal(featuredPost([live])?.title, 'Live essay');
  assert.equal(filterPosts([live], 'essay', 'ET AI').length, 1);
  assert.equal(filterPosts([live], 'essay', 'Schools').length, 0);
});

test('slugs, rss, and buy links stay plain', () => {
  assert.equal(slugify('ET AI & Schools'), 'et-ai-schools');
  const xml = renderRss([{ ...SAMPLE_POSTS[0], sample: false, status: 'published', publishedAt: 10 }]);
  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /Poket School Blog/);
  assert.equal(xml.includes('<script'), false);
  assert.equal(AFFILIATE_REL, 'sponsored nofollow');
});
