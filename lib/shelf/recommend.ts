import type { ShelfItem } from './types';

/**
 * Rank shelf items against something the reader already opened.
 * Shared tags, subject, level, form, and series all count.
 * Weekly popularity only breaks ties.
 */
export function recommend(items: ShelfItem[], source: ShelfItem, limit = 8): ShelfItem[] {
  const tags = new Set(source.tags);
  return items
    .filter(item => item.id !== source.id)
    .map(item => {
      let score = 0;
      if (item.subject && source.subject && item.subject.toLowerCase() === source.subject.toLowerCase()) score += 4;
      if (item.level && source.level && item.level === source.level) score += 3;
      if (item.form && source.form && item.form === source.form) score += 2;
      if (item.seriesId && item.seriesId === source.seriesId) score += 6;
      score += item.tags.filter(tag => tags.has(tag)).length;
      return { item, score };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || b.item.weekly - a.item.weekly)
    .slice(0, limit)
    .map(row => row.item);
}
