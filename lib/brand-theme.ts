/**
 * TODO_BRAND
 * Placeholder Poket School palette until Harry sends the mockup hex values.
 * The brand is a blue gradient. Forest green #1A3C34 and gold #C8922A are
 * Rochford's school colours, not Poket School's. Institution white-label
 * colours stay on each academy. Swap these values and the matching --brand-*
 * variables in app/globals.css together.
 */

export const BRAND_PALETTE = 'TODO_BRAND' as const;

export const BRAND = {
  /** TODO_BRAND deep end of the gradient. */
  ink: '#0B3A6E',
  /** TODO_BRAND middle stop. */
  mid: '#1B6FE0',
  /** TODO_BRAND bright end. */
  bright: '#4C9BFF',
  /** TODO_BRAND pale card wash. */
  mist: '#E8F2FF',
  /** TODO_BRAND softer surface. */
  foam: '#F5F9FF',
  /** TODO_BRAND text on the deep and middle stops. */
  on: '#FFFFFF',
} as const;

/** TODO_BRAND. Screens use the bg-brand-gradient utility, which reads --brand-gradient. */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #0B3A6E 0%, #1B6FE0 52%, #4C9BFF 100%)';

export type BrandInk = keyof typeof BRAND;

/** PDF colour operator. 1 stays `1` so a full channel matches the existing files. */
export function brandPdfRgb(hex: string): string {
  return brandRgbChannels(hex).map((channel) => (channel === 1 ? '1' : channel.toFixed(3))).join(' ');
}

export function brandRgbChannels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((start) => Number.parseInt(raw.slice(start, start + 2), 16) / 255) as [number, number, number];
}
