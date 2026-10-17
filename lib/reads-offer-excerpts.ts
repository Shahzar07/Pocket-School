import { publishedBooks } from './reads/seed';

export type ExcerptLane = 'academic' | 'story';

export interface ReadsExcerpt {
  id: string;
  lane: ExcerptLane;
  title: string;
  chapter: string;
  kicker: string;
  paragraphs: string[];
  usd: number;
  readerHref: string;
}

const LANES: { id: string; lane: ExcerptLane; kicker: string }[] = [
  { id: 'cells-to-systems', lane: 'academic', kicker: 'IGCSE Biology' },
  { id: 'plain-contract', lane: 'academic', kicker: 'LLB Contract' },
  { id: 'malacca', lane: 'academic', kicker: 'Lower Secondary history' },
  { id: 'harbour-light', lane: 'story', kicker: 'Novel' },
  { id: 'blue-notebook', lane: 'story', kicker: 'Primary story' },
  { id: 'yellow-window', lane: 'story', kicker: 'Children’s story' },
];

function proseParagraphs(markdown: string): string[] {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .split(/\n{2,}/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(part => part.length > 0 && !part.startsWith('#'));
}

/** Opening paragraphs from the published seed, unchanged apart from whitespace. */
export function readsOfferExcerpts(): ReadsExcerpt[] {
  const books = publishedBooks();
  return LANES.map(lane => {
    const book = books.find(item => item.id === lane.id);
    if (!book) throw new Error(`Seed book ${lane.id} is not published.`);
    const chapter = book.chapters.find(item => item.preview) ?? book.chapters[0];
    if (!chapter) throw new Error(`${book.title} has no chapter.`);
    const paragraphs = proseParagraphs(chapter.markdown);
    const chosen = paragraphs[0] && paragraphs[0].length > 650 ? paragraphs.slice(0, 1) : paragraphs.slice(0, 2);
    if (chosen.length === 0) throw new Error(`${book.title} has no prose to excerpt.`);
    return {
      id: book.id,
      lane: lane.lane,
      title: book.title,
      chapter: chapter.title,
      kicker: lane.kicker,
      paragraphs: chosen,
      usd: book.priceUsd,
      readerHref: `/reads/read/${book.id}`,
    };
  });
}
