/**
 * Children's illustrated stories on the existing Book Studio and reader.
 * Age bands are the level. School years are not used.
 * Pricing is left on the book the studio already stores.
 */

import type { AgeRating, Book, BookChapter } from '@/lib/reads/types';
import { BRAND_COVER } from '@/lib/reads/cover';

export const CHILDRENS_CATEGORY = 'childrens_stories' as const;
export const CHILDRENS_GENRE = "Children's Stories";

export const AGE_BANDS = [
  { id: '3-5', label: 'Ages 3–5', ageRating: '5+' as AgeRating, words: 16 },
  { id: '5-7', label: 'Ages 5–7', ageRating: '8+' as AgeRating, words: 28 },
  { id: '6-8', label: 'Ages 6–8', ageRating: '8+' as AgeRating, words: 40 },
  { id: '8-10', label: 'Ages 8–10', ageRating: '12+' as AgeRating, words: 60 },
] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]['id'];

export type ReaderTypeface = 'serif' | 'sans' | 'dyslexia';

export function ageBand(id: string | undefined) {
  return AGE_BANDS.find(band => band.id === id) ?? AGE_BANDS[1];
}

export function isPictureBook(book: { pictureBook?: boolean; category?: string; genre?: string } | null | undefined): boolean {
  if (!book) return false;
  return book.pictureBook === true || book.category === CHILDRENS_CATEGORY || book.genre === CHILDRENS_GENRE;
}

export function storyShape(bandId: string | undefined): Pick<Book, 'category' | 'form' | 'genre' | 'ageRating' | 'readingLevel' | 'pictureBook' | 'ageBand'> {
  const band = ageBand(bandId);
  return {
    category: CHILDRENS_CATEGORY,
    form: 'fiction',
    genre: CHILDRENS_GENRE,
    ageRating: band.ageRating,
    readingLevel: 'primary',
    pictureBook: true,
    ageBand: band.id,
  };
}

export function fullPageImage(alt: string, src: string): string {
  const safeAlt = alt.replace(/[\[\]]/g, '').trim() || 'Illustration';
  return `!full[${safeAlt}](${src})`;
}

export function withPageIllustration(markdown: string, alt: string, src: string): string {
  const image = fullPageImage(alt, src);
  if (/!(?:full)?\[[^\]]*\]\([^)]*\)/.test(markdown)) {
    return markdown.replace(/!(?:full)?\[[^\]]*\]\([^)]*\)/, image);
  }
  const text = markdown.trim();
  return text ? `${image}\n\n${text}` : image;
}

export interface PictureSpread {
  image: { alt: string; src: string; caption: string } | null;
  text: string;
}

/** Image addresses may contain parentheses, as data URLs do. */
function imageBlock(block: string): { alt: string; src: string; caption: string } | null {
  const trimmed = block.trim();
  const start = /^(?:!full|!)\[([^\]]*)\]\(/.exec(trimmed);
  if (!start || !trimmed.endsWith(')')) return null;
  let inside = trimmed.slice(start[0].length, -1).trim();
  let caption = '';
  const quoted = /^(.*)\s+"([^"]*)"$/.exec(inside);
  if (quoted) {
    inside = quoted[1].trim();
    caption = quoted[2];
  }
  if (!inside || /\s/.test(inside)) return null;
  return { alt: start[1] || 'Illustration', src: inside, caption };
}

export function pictureSpreads(markdown: string): PictureSpread[] {
  const blocks = markdown.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  const spreads: PictureSpread[] = [];
  let current: PictureSpread | null = null;
  for (const block of blocks) {
    const image = imageBlock(block);
    if (image) {
      if (current) spreads.push(current);
      current = { image, text: '' };
      continue;
    }
    const plain = block.replace(/^#{1,3}\s+/, '').replace(/^>\s?/, '').trim();
    if (!plain) continue;
    if (!current) current = { image: null, text: '' };
    current.text = current.text ? `${current.text}\n\n${plain}` : plain;
  }
  if (current) spreads.push(current);
  return spreads.length ? spreads : [{ image: null, text: markdown.trim() }];
}

export function readingPages(markdown: string, picture: boolean): string[] {
  if (!picture) return [];
  return pictureSpreads(markdown).map(spread => spread.text);
}

export function wordsOf(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/** Local picture-book draft. No model key, and no school year in the prose. */
export function fallbackStory(brief: string, bandId: string | undefined): {
  title: string;
  blurb: string;
  chapters: { title: string; text: string; illustration: string }[];
} {
  const band = ageBand(bandId);
  const topic = brief.trim().replace(/\s+/g, ' ').slice(0, 80) || 'a yellow window';
  const child = 'a small child in a yellow raincoat';
  return {
    title: topic.charAt(0).toUpperCase() + topic.slice(1),
    blurb: `A picture book for ${band.label}. The same child appears on every page. ET AI drafted it. The author edits and approves each page.`,
    chapters: [
      {
        title: 'The window',
        text: `There was ${child}. The window was yellow. Rain tapped the glass.`,
        illustration: `${child}, standing at a yellow window, rain outside, same raincoat, no letters`,
      },
      {
        title: 'One step',
        text: `The child opened the door. One step. The rain was warm.`,
        illustration: `${child} in the same yellow raincoat, one step outside the same yellow window, no letters`,
      },
      {
        title: 'Home',
        text: `The child came back. The window was still yellow. That was enough.`,
        illustration: `${child} back inside by the same yellow window, same raincoat, no letters`,
      },
    ],
  };
}

export function storyChapters(
  pages: { title: string; text: string }[],
  idPrefix: string,
): BookChapter[] {
  return pages.map((page, order) => ({
    id: `${idPrefix}-${order + 1}`,
    order,
    title: page.title,
    markdown: page.text.trim(),
    preview: order === 0,
    origin: 'ai' as const,
  }));
}

export function storyPublishIssues(book: {
  pictureBook?: boolean;
  category?: string;
  genre?: string;
  chapters: { title: string; markdown: string }[];
}): string[] {
  if (!isPictureBook(book)) return [];
  const issues: string[] = [];
  const bare = book.chapters.filter(chapter => !/!full\[/.test(chapter.markdown));
  if (bare.length) issues.push(bare.length === 1 ? `“${bare[0].title}” needs an illustration.` : `${bare.length} pages need an illustration.`);
  const prose = book.chapters.map(chapter => chapter.markdown).join('\n');
  if (/Year\s+\d/i.test(prose)) issues.push('A children’s story uses an age band, not a school year.');
  return issues;
}

export function readerTypeface(prefs: { typeface?: ReaderTypeface; dyslexia?: boolean }): ReaderTypeface {
  if (prefs.typeface) return prefs.typeface;
  return prefs.dyslexia ? 'dyslexia' : 'serif';
}

export function readerFontFamily(typeface: ReaderTypeface): string {
  if (typeface === 'dyslexia') return 'Lexend, Verdana, sans-serif';
  if (typeface === 'sans') return 'Verdana, "Segoe UI", sans-serif';
  return '"Instrument Serif", Georgia, serif';
}

export function blankChildrensStory(now = Date.now()): Book {
  const band = ageBand('5-7');
  return {
    id: `story-${now}`,
    title: 'Untitled story',
    author: 'ET AI',
    blurb: '',
    cover: { ...BRAND_COVER },
    ...storyShape(band.id),
    curriculumTags: [{ programme: 'Primary', subject: 'English', year: band.label }],
    status: 'draft',
    version: 1,
    accessMode: 'subscription',
    minTier: 1,
    priceUsd: 0,
    priceRM: 0,
    licensable: false,
    programme: 'Primary',
    allocateLibrary: true,
    allocateMarketplace: false,
    showcase: { featured: false, priority: 0, from: '', until: '' },
    targets: ['students'],
    chapters: [{ id: `p-${now}`, order: 0, title: 'Page 1', markdown: '', preview: true, origin: 'human' }],
    weeklyReads: 0,
    releasedAt: new Date(now).toISOString().slice(0, 10),
    coverBrief: { styleId: 'illustrated-kids', placement: 'bottom', font: 'rounded', brand: true },
  };
}
