/**
 * Held brand palette. Harry is confirming these inks. A later blue gradient
 * replaces the values in this module and the matching --brand-* variables in
 * app/globals.css. Screens read the CSS variables. PDFs read this module.
 */

export const BRAND = {
  forest: '#1A3C34',
  gold: '#C8922A',
  coral: '#E36A4F',
  blue: '#3C8DFF',
  cream: '#F6F1E7',
  sand: '#F8E7C4',
} as const;

export type BrandInk = keyof typeof BRAND;

/** PDF colour operator. 1 stays `1` so a full channel matches the existing files. */
export function brandPdfRgb(hex: string): string {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((start) => {
    const channel = Number.parseInt(raw.slice(start, start + 2), 16) / 255;
    return channel === 1 ? '1' : channel.toFixed(3);
  }).join(' ');
}
