/**
 * Poket School brand tokens.
 * A platform pass sets the same names site-wide. These values are the local
 * copy for screens, PDFs, and cards on this branch. Forest green and gold
 * are Rochford school colours, not this palette. Institution white-label
 * colours stay on each academy.
 *
 * Plus Jakarta Sans is the UI face and Instrument Sans is the display face.
 * Radius steps are 12, 18, 24, 32, and pill.
 */

export const BRAND = {
  /** Main brand blue. */
  primary: '#2786A4',
  /** Deep stop of the hero gradient. White text clears on this. */
  blueDeep: '#1E6A83',
  /** Bright stop. Use ink text on it. */
  blueBright: '#6FBBCE',
  /** Cyan fill. Use ink text on it, with a brand-blue border. */
  amber: '#3FE0D0',
  /** Danger. */
  coral: '#D0553F',
  /** Success. */
  good: '#1F8A70',
  /** Page background. */
  bg: '#F4F6F6',
  /** Pale brand wash. */
  wash: '#E9F7FA',
  /** Card and text on the deep and primary stops. */
  card: '#FFFFFF',
  /** Hairline. */
  line: '#E7EDED',
  /** Body text. */
  ink: '#203337',
  /** Secondary text. */
  muted: '#5F7074',
  /** Role washes. */
  teacher: '#E9F7FA',
  parent: '#E5F6EF',
  admin: '#F0F5F4',
} as const;

/** Hero surface. Screens use the bg-hero utility, which reads --hero-gradient. */
export const HERO_GRADIENT = 'linear-gradient(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%)';

export const RADIUS = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const FONT = {
  sans: 'Plus Jakarta Sans',
  display: 'Instrument Sans',
} as const;

export type BrandToken = keyof typeof BRAND;

/** PDF colour operator. 1 stays `1` so a full channel matches the existing files. */
export function brandPdfRgb(hex: string): string {
  return brandRgbChannels(hex).map((channel) => (channel === 1 ? '1' : channel.toFixed(3))).join(' ');
}

export function brandRgbChannels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((start) => Number.parseInt(raw.slice(start, start + 2), 16) / 255) as [number, number, number];
}
