import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blogCoverReady, blogImageError, inlineImageMarkdown, publishImageError } from './images';

test('blog images reject the wrong type, a huge file, and missing alt text', () => {
  assert.match(blogImageError({ type: 'application/pdf', size: 100 }, 'A diagram'), /JPEG/);
  assert.match(blogImageError({ type: 'image/png', size: 6 * 1024 * 1024 }, 'A diagram'), /5 MB/);
  assert.match(blogImageError({ type: 'image/png', size: 1000 }, ' '), /alt text/);
  assert.equal(blogImageError({ type: 'image/webp', size: 1000 }, 'Students in a lab'), '');
});

test('a cover without alt text cannot be saved', () => {
  assert.match(blogCoverReady('https://example.com/cover.webp', ''), /alt text/);
  assert.equal(blogCoverReady('', ''), '');
});

test('publishing needs a banner and alt text', () => {
  assert.match(publishImageError('', 'A blue banner'), /banner/);
  assert.match(publishImageError('/blog/essay.webp', ''), /alt text/);
  assert.equal(publishImageError('/blog/essay.webp', 'Blue banner for the essay'), '');
});

test('inline images keep the alt text in the essay', () => {
  assert.equal(inlineImageMarkdown({ url: 'https://example.com/a.png', alt: 'A graph' }), '![A graph](https://example.com/a.png)');
});
