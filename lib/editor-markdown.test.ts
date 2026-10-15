import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
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
    expect(markdown).toContain('# Harbour');
    expect(markdown).toContain('**quiet**');
    expect(markdown).toContain('*old*');
    expect(markdown).toContain('- Tea');
    expect(markdown).toContain(imageMarkdown('The third window', 'https://example.com/light.jpg', 'Night', true));
  });

  it('splits a paste into chapters on headings', () => {
    const blocks = splitByHeadings('# One\n\nFirst page.\n\n## Two\n\nSecond page.');
    expect(blocks.map(block => block.title)).toEqual(['One', 'Two']);
    expect(blocks[0]?.body).toBe('First page.');
    expect(blocks.every(block => block.origin === 'import')).toBe(true);
  });
});
