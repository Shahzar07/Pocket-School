import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMPLE_POSTS, featuredPost, filterPosts, isPublic, renderRss, slugify } from './posts';

test('sample drafts stay unpublished', () => {
  assert.equal(SAMPLE_POSTS.length, 3);
  for (const post of SAMPLE_POSTS) {
    assert.equal(post.sample, true);
    assert.equal(post.status, 'draft');
    assert.match(post.title, /^Sample draft:/);
    assert.equal(isPublic(post, Date.now()), false);
    assert.equal(/Udemy|Coursera|Year\s+\d|\bPocket\b|\bET\b(?!\s)/i.test(`${post.title}\n${post.body}`), false);
  }
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

test('slugs and rss stay plain', () => {
  assert.equal(slugify('ET AI & Schools'), 'et-ai-schools');
  const xml = renderRss([{ ...SAMPLE_POSTS[0], sample: false, status: 'published', publishedAt: 10 }]);
  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /Poket School Blog/);
  assert.equal(xml.includes('<script'), false);
});
