import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownForPageCount } from './page-count';
import { paginateChapter } from './paginate';

test('a translated chapter uses its own page count', () => {
  const source = 'One short page.';
  const translated = Array.from({ length: 12 }, (_, index) => `Perenggan ${index}. ${'kata '.repeat(40)}`).join('\n\n');
  const shown = markdownForPageCount(source, translated, true);
  assert.ok(paginateChapter(shown).length > paginateChapter(source).length);
  assert.equal(markdownForPageCount(source, translated, false), source);
  assert.equal(markdownForPageCount(source, '   ', true), source);
});
