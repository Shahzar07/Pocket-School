import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { htmlToMarkdown, imageMarkdown, splitByHeadings } from '../components/editor/markdown';

describe('shared manuscript markdown', () => {
  it('keeps headings, emphasis, and a captioned image', () => {
    const { document } = parseHTML(`<html><body>
      <h1>Harbour</h1>
      <p>A <strong>quiet</strong> jetty and an <em>old</em> lamp.</p>
      <ul><li>Tea</li><li>Boat</li></ul>
      <figure data-full="1"><img alt="The third window" src="https://example.com/light.jpg" /><figcaption>Night</figcaption></figure>
    </body></html>`);
    const markdown = htmlToMarkdown('', document.body as unknown as Parameters<typeof htmlToMarkdown>[1]);
    assert.match(markdown, /# Harbour/);
    assert.match(markdown, /\*\*quiet\*\*/);
    assert.match(markdown, /\*old\*/);
    assert.match(markdown, /- Tea/);
    assert.match(markdown, new RegExp(imageMarkdown('The third window', 'https://example.com/light.jpg', 'Night', true).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  it('splits a paste into chapters on headings', () => {
    const blocks = splitByHeadings('# One\n\nFirst page.\n\n## Two\n\nSecond page.');
    assert.deepEqual(blocks.map(block => block.title), ['One', 'Two']);
    assert.equal(blocks[0]?.body, 'First page.');
    assert.equal(blocks.every(block => block.origin === 'import'), true);
  });
});
