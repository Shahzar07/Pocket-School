import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publishIssues, screenCoverAge } from './cover';

describe('cover age screen', () => {
  it('blocks a violent brief on a young title', () => {
    const result = screenCoverAge('8+', 'A harbour at dusk with a weapon on the pier');
    assert.equal(result.ok, false);
  });

  it('allows a quiet brief', () => {
    const result = screenCoverAge('8+', 'A blue notebook on a kitchen table');
    assert.equal(result.ok, true);
    assert.match(result.note, /8\+/);
  });

  it('treats a missing rating like 12+', () => {
    assert.equal(screenCoverAge('mystery', 'a quiet harbour').ok, true);
    assert.equal(screenCoverAge('mystery', 'explicit scene').ok, false);
  });

  it('holds publish until the cover is checked and every picture has alt text', () => {
    const open = publishIssues({
      coverBrief: { artSrc: 'x', placement: 'bottom', font: 'serif', brand: true },
      images: [{ alt: '' }],
      chapters: [{ markdown: '![](pic)' }],
    });
    assert.equal(open.length, 3);
    const ready = publishIssues({
      coverBrief: { artSrc: 'x', placement: 'bottom', font: 'serif', brand: true, ageOk: true },
      images: [{ alt: 'A harbour' }],
      chapters: [{ markdown: '![A harbour](pic)' }],
    });
    assert.deepEqual(ready, []);
  });
});
