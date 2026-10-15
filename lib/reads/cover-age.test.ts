import { describe, expect, it } from 'vitest';
import { publishIssues, screenCoverAge } from './cover';

describe('cover age screen', () => {
  it('blocks a violent brief on a young title', () => {
    const result = screenCoverAge('8+', 'A harbour at dusk with a weapon on the pier');
    expect(result.ok).toBe(false);
  });

  it('allows a quiet brief', () => {
    const result = screenCoverAge('8+', 'A blue notebook on a kitchen table');
    expect(result.ok).toBe(true);
    expect(result.note).toContain('8+');
  });

  it('treats a missing rating like 12+', () => {
    expect(screenCoverAge('mystery', 'a quiet harbour').ok).toBe(true);
    expect(screenCoverAge('mystery', 'explicit scene').ok).toBe(false);
  });

  it('holds publish until the cover is checked and every picture has alt text', () => {
    const open = publishIssues({
      coverBrief: { artSrc: 'x', placement: 'bottom', font: 'serif', brand: true },
      images: [{ alt: '' }],
      chapters: [{ markdown: '![](pic)' }],
    });
    expect(open).toHaveLength(3);
    const ready = publishIssues({
      coverBrief: { artSrc: 'x', placement: 'bottom', font: 'serif', brand: true, ageOk: true },
      images: [{ alt: 'A harbour' }],
      chapters: [{ markdown: '![A harbour](pic)' }],
    });
    expect(ready).toEqual([]);
  });
});