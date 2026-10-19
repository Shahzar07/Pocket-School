export type CoverFont = 'serif' | 'sans' | 'rounded';
export type CoverPlacement = 'top' | 'center' | 'bottom';

/**
 * Default cover paint for the picture, not the page chrome. The image model
 * and the fallback SVG need real colours, so these stay hex. Page chrome uses
 * `--ps-cyan`, `--ps-cyan-text` (#1E6A83), `--ps-cyan-ink` (#203337) and
 * `--ps-cyan-border`. The dark stop is #1E6A83 so white title text clears
 * WCAG AA. #2786A4 is only the far end of the gradient. The kicker uses
 * #E9F7FA, which clears 4.5:1 on #1E6A83. Electric cyan #3FE0D0 on that
 * blue is 3.7:1, and #14B8A6 on white is 2.5:1, so neither is text on a light ground.
 */
export const BRAND_COVER = {
  from: '#1E6A83',
  to: '#2786A4',
  accent: '#E9F7FA',
} as const;

/** Picture fills for fallback art. Electric cyan is a shape, never UI text. */
export const BRAND_FILLS = ['#1E6A83', '#2786A4', '#6FBBCE', '#3FE0D0'] as const;

/** Sentence the cover model receives. Artwork may use electric cyan. UI text may not. */
export const COVER_BRAND_PALETTE = 'Poket School palette: blue gradient #1E6A83, #2786A4 and #6FBBCE, with electric cyan #3FE0D0 as an accent in the picture only. No amber, mustard, gold, olive, #1A3C34, or #C8922A. Do not use #3FE0D0 or #14B8A6 as text on a light background.';

/** Book-only cover decisions. The picture itself comes from components/media. */
export interface CoverBrief {
  styleId?: string;
  artSrc?: string;
  prompt?: string;
  placement: CoverPlacement;
  font: CoverFont;
  brand: boolean;
  /** Required before publish. Describes the cover for someone who cannot see it. */
  alt?: string;
  ageOk?: boolean;
  ageNote?: string;
}

const RISKS: Record<string, RegExp[]> = {
  '5+': [/blood/i, /kill/i, /gun/i, /horror/i, /death/i, /weapon/i, /romance/i, /kiss/i, /nude/i],
  '8+': [/gore/i, /sexual/i, /explicit/i, /horror/i, /weapon/i, /nude/i],
  '12+': [/gore/i, /sexual/i, /explicit/i, /nude/i],
  '14+': [/explicit sexual/i, /porn/i, /nude/i],
  '16+': [/porn/i],
  '18+': [],
};

/** Local screen before publish. The picture prompt, title, and blurb are the text it reads. */
export function screenCoverAge(ageRating: string, text: string): { ok: boolean; note: string } {
  const rules = RISKS[ageRating] ?? RISKS['12+'];
  const hit = rules.find(rule => rule.test(text));
  if (hit) return { ok: false, note: `This cover is not a fit for ${ageRating}. Change the brief or the age rating.` };
  return { ok: true, note: `Suitable for ${ageRating}.` };
}

/** Book Studio blocks publish when a chosen cover is unchecked or a picture has no alt text. */
export function publishIssues(book: {
  coverBrief?: CoverBrief;
  images?: { alt: string }[];
  chapters: { markdown: string }[];
}): string[] {
  const issues: string[] = [];
  if (book.coverBrief?.artSrc && book.coverBrief.ageOk !== true) {
    issues.push('Check the cover is right for this age before publishing.');
  }
  if ((book.images ?? []).some(image => !image.alt.trim())) {
    issues.push('Every picture needs alt text before publishing.');
  }
  if (book.chapters.some(chapter => /!(?:full)?\[\s*\]\(/.test(chapter.markdown))) {
    issues.push('A picture in the chapter text is missing alt text.');
  }
  return issues;
}
