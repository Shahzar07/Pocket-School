/**
 * Poket School dashboard colour system.
 *
 * Hues come from `./tokens`. Text inks are the same colours when they clear
 * WCAG AA, and a darker step of the same hue when the brand swatch does not
 * (light amber `#E2AF4D` and light coral `#D0553F` are fills, not small text).
 *
 * Charts use six hues, each with a different pattern, so a colour blind
 * reader can still tell series apart. Labels name the series as well.
 */

import { dark, light } from './tokens';

export const ACCENT_IDS = ['teal', 'amber', 'coral', 'violet', 'emerald', 'sky'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const CATEGORY_IDS = ['analytics', 'grades', 'sparks', 'integrity', 'behaviour', 'attendance'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Category → accent. Same mapping in light and dark. */
export const CATEGORY_ACCENT: Record<CategoryId, AccentId> = {
  analytics: 'teal',
  grades: 'amber',
  sparks: 'coral',
  integrity: 'violet',
  behaviour: 'emerald',
  attendance: 'sky',
};

export interface AccentInk {
  /** Text, icons, and chart fills. */
  ink: string;
  /** Text that sits on a solid `ink` fill. */
  onFill: string;
}

/** Brand swatches for fills and washes. Text uses `LIGHT_INKS` / `DARK_INKS`. */
export const BRAND_SWATCH = {
  light: {
    primary: light.primary,
    amber: light.amber,
    coral: light.coral,
    good: light.good,
    mint: light.mint,
  },
  dark: {
    primary: dark.primary,
    amber: dark.amber,
    coral: dark.coral,
    good: dark.good,
    mint: dark.mint,
  },
} as const;

export const LIGHT_INKS: Record<AccentId, AccentInk> = {
  teal: { ink: light.blueDeep, onFill: light.onPrimary },
  amber: { ink: '#9A5B00', onFill: light.onPrimary },
  coral: { ink: '#C23B2E', onFill: light.onPrimary },
  violet: { ink: '#6D28D9', onFill: light.onPrimary },
  emerald: { ink: light.mintInk, onFill: light.onPrimary },
  sky: { ink: '#0369A1', onFill: light.onPrimary },
};

export const DARK_INKS: Record<AccentId, AccentInk> = {
  teal: { ink: dark.primary, onFill: dark.onPrimary },
  amber: { ink: dark.amber, onFill: dark.onPrimary },
  coral: { ink: dark.coral, onFill: dark.onPrimary },
  violet: { ink: '#C4B5FD', onFill: dark.onPrimary },
  emerald: { ink: dark.good, onFill: dark.onPrimary },
  sky: { ink: '#7DD3FC', onFill: dark.onPrimary },
};

export const ACCENT_LABEL: Record<AccentId, string> = {
  teal: 'Teal',
  amber: 'Amber',
  coral: 'Coral',
  violet: 'Violet',
  emerald: 'Emerald',
  sky: 'Sky',
};

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  analytics: 'Analytics',
  grades: 'Grades',
  sparks: 'Sparks',
  integrity: 'Integrity',
  behaviour: 'Behaviour',
  attendance: 'Attendance',
};

/** Pattern drawn over the fill so series stay distinct without colour. */
export const ACCENT_PATTERN: Record<AccentId, 'solid' | 'stripe' | 'dots' | 'cross' | 'dash' | 'bars'> = {
  teal: 'solid',
  amber: 'stripe',
  coral: 'dots',
  violet: 'cross',
  emerald: 'dash',
  sky: 'bars',
};

export const MEDAL_IDS = ['gold', 'silver', 'bronze'] as const;
export type MedalId = (typeof MEDAL_IDS)[number];

export interface MedalInk {
  fill: string;
  ink: string;
  label: string;
  place: string;
}

export const LIGHT_MEDALS: Record<MedalId, MedalInk> = {
  gold: { fill: '#E8B84A', ink: '#3D2A06', label: 'Gold', place: '1st' },
  silver: { fill: '#D5DDE3', ink: '#1F2933', label: 'Silver', place: '2nd' },
  bronze: { fill: '#E0A15A', ink: '#3A2412', label: 'Bronze', place: '3rd' },
};

export const DARK_MEDALS: Record<MedalId, MedalInk> = {
  gold: { fill: '#F0C36A', ink: '#3D2A06', label: 'Gold', place: '1st' },
  silver: { fill: '#E6EDF2', ink: '#1F2933', label: 'Silver', place: '2nd' },
  bronze: { fill: '#E8B07A', ink: '#3A2412', label: 'Bronze', place: '3rd' },
};

export const LIGHT_CANVAS = light.card;
export const LIGHT_PAGE = light.bg;
export const DARK_CANVAS = dark.bg;
export const DARK_CARD = dark.card;

export function accentVar(id: AccentId): string {
  return `--ps-${id}`;
}

export function onAccentVar(id: AccentId): string {
  return `--ps-on-${id}`;
}

export function patternId(id: AccentId): string {
  return `ps-pat-${id}`;
}

export function accentForIndex(index: number): AccentId {
  const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return ACCENT_IDS[safe % ACCENT_IDS.length] ?? 'teal';
}

export function accentForCategory(category: CategoryId): AccentId {
  return CATEGORY_ACCENT[category];
}

export type TrendDirection = 'up' | 'down' | 'flat';

export function trendFromDelta(delta: number): TrendDirection {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/** Positive means the person climbed (a smaller rank number). */
export function rankMovement(previousRank: number | null | undefined, rank: number): number {
  if (previousRank == null || previousRank < 1) return 0;
  return previousRank - rank;
}

export function medalForRank(rank: number): MedalId | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}
