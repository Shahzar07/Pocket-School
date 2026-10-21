import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMPLE_POSTS } from './posts';
import { allowIndex, jsonLdForPost, localSeoSuggestion, parseSeoFields, seoScore } from './seo';

test('seo fields parse and a noindex essay leaves the sitemap scripts empty', () => {
  const fields = parseSeoFields({
    seoTitle: 'A title',
    robotsIndex: false,
    customFields: [{ key: 'board', kind: 'text', value: 'Cambridge' }, { key: '', kind: 'text', value: 'skip' }],
    ogImage: 'javascript:alert(1)',
  });
  assert.equal(fields.seoTitle, 'A title');
  assert.equal(fields.robotsIndex, false);
  assert.equal(fields.customFields.length, 1);
  assert.equal(fields.ogImage, '');
  const post = { ...SAMPLE_POSTS[0], ...fields, sample: false, status: 'published' as const };
  assert.equal(allowIndex(post), false);
  assert.equal(jsonLdForPost(post).length, 0);
});

test('suggestions come from the essay and the checklist counts them', () => {
  const post = SAMPLE_POSTS[0];
  const suggestion = localSeoSuggestion(post);
  assert.equal(suggestion.seoTitle, post.title.slice(0, 60));
  assert.equal(/\d{2,}%/.test(suggestion.tldr || ''), false);
  const scored = seoScore({ ...post, ...suggestion, tldr: suggestion.tldr, seoTitle: post.title, seoDescription: post.excerpt });
  assert.equal(scored.checks.some((item) => item.id === 'tldr'), true);
  const indexed = jsonLdForPost({ ...post, sample: false, status: 'published' });
  assert.equal(indexed.some((block) => block['@type'] === 'BlogPosting'), true);
  assert.equal(indexed.some((block) => block['@type'] === 'BreadcrumbList'), true);
});
