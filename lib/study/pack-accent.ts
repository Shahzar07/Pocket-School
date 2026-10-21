/**
 * Exam pack card colours. Strips tell the boards apart; label text stays
 * readable. Cyan is a fill, not text on a light card.
 */

export type PackFamily = 'national' | 'international' | 'diploma';

export const PACK_STRIPS = {
  national: '#1E6A83',
  international: 'linear-gradient(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%)',
  diploma: '#3FE0D0',
} as const;

/** Light text is blue or ink. Dark cards use cyan so the label stays visible. */
export const PACK_LABEL = {
  light: '#1E6A83',
  dark: '#3FE0D0',
} as const;

const OFF_BRAND = /#(?:8b5cf6|e5484d|30a46c|e8a33d|0ea5e9|c8820a|c8922a|f59e0b|ef4444|a855f7|7c3aed|f97316|ff0000)/i;

export function packFamily(board: string): PackFamily {
  const name = board.trim().toLowerCase();
  if (name.startsWith('diploma')) return 'diploma';
  if (name.startsWith('international')) return 'international';
  return 'national';
}

export function packStrip(board: string): string {
  return PACK_STRIPS[packFamily(board)];
}

export function accentIsOnBrand(value: string): boolean {
  return !OFF_BRAND.test(value);
}
