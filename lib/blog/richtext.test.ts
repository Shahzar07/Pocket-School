import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { htmlToMarkdown, markdownToHtml, sanitizeHtml, storedBody, wordCount } from './richtext';

const { window } = parseHTML('<!doctype html><html><body></body></html>');
Object.assign(globalThis, { DOMParser: window.DOMParser });

const SAMPLE = [
  '## Revision',
  '',
  'A **bold** *note* ++under++ ~~gone~~ `term` and [Poket School](https://poketschool.ai).',
  '',
  '- one',
  '- two',
  '',
  '1. first',
  '',
  '> Keep it short.',
  '',
  '---',
  '',
  '![Banner](/blog/igcse-revision-with-et-ai.webp)',
  '',
  '| Topic | Note |',
  '| --- | --- |',
  '| Cells | Draw them |',
  '',
  '```',
  'const ready = true;',
  '```',
].join('\n');

test('markdown and editor html round-trip the journal marks', () => {
  const html = markdownToHtml(SAMPLE);
  assert.match(html, /<h2>Revision<\/h2>/);
  assert.match(html, /<u>under<\/u>/);
  assert.match(html, /<s>gone<\/s>/);
  assert.match(html, /<table>/);
  const back = htmlToMarkdown(html);
  assert.match(back, /## Revision/);
  assert.match(back, /\*\*bold\*\*/);
  assert.match(back, /\+\+under\+\+/);
  assert.match(back, /~~gone~~/);
  assert.match(back, /\[Poket School\]\(https:\/\/poketschool\.ai\)/);
  assert.match(back, /- one/);
  assert.match(back, /1\. first/);
  assert.match(back, /> Keep it short/);
  assert.match(back, /!\[Banner\]\(\/blog\/igcse-revision-with-et-ai\.webp\)/);
  assert.match(back, /\| Topic \| Note \|/);
  assert.match(back, /const ready = true/);
  assert.equal(wordCount('two words'), 2);
});

test('stored html is markdown without scripts', () => {
  const clean = sanitizeHtml('<p>Hello</p><script>alert(1)</script><iframe src="https://example.com"></iframe>');
  assert.equal(clean.includes('script'), false);
  assert.equal(clean.includes('iframe'), false);
  assert.match(storedBody('<p>Hello <strong>there</strong></p>'), /Hello \*\*there\*\*/);
});
