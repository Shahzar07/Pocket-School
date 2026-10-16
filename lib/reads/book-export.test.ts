import assert from 'node:assert/strict';
import test from 'node:test';
import { bookEpub, bookPdf, chapterPlain } from './book-export';
import { copyrightLine } from '@/lib/insights/copyright';

const book = {
  id: 'yellow-window',
  title: 'The yellow window',
  chapters: [
    {
      id: 'yw-1',
      order: 0,
      title: 'The window',
      markdown: '!full[A yellow window](data:image/svg+xml,1)\n\nThere was a small child in a yellow raincoat.',
    },
  ],
};

test('a book download keeps the picture out of the words and carries the copyright line', () => {
  assert.equal(chapterPlain(book.chapters[0].markdown), 'There was a small child in a yellow raincoat.');
  assert.doesNotMatch(chapterPlain(book.chapters[0].markdown), /Year\s+\d/);
  const year = 2026;
  const pdf = new TextDecoder().decode(bookPdf(book, year));
  const epub = new TextDecoder().decode(bookEpub(book, year));
  const line = copyrightLine(year);
  assert.match(pdf, /PoketSchool\.Ai/);
  assert.match(pdf, /The yellow window/);
  assert.match(epub, /application\/epub\+zip/);
  assert.match(epub, /ET AI/);
  assert.ok(epub.includes(line));
  assert.match(epub, /yellow raincoat/);
  assert.doesNotMatch(epub, /data:image/);
});
