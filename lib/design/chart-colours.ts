/**
 * Poket School dashboard colour system.
 *
 * One palette for student, parent, teacher, institution, and admin screens.
 * Light inks clear WCAG AA (4.5:1) on white and on the page. Dark inks clear
 * 4.5:1 on the dark canvas and on cards. Solid fills pair with `--ps-on-*`
 * so text sitting on a fill also clears 4.5:1.
 *
 * Charts use the same six hues, each with a different pattern, so a colour
 * blind reader can still tell series apart. Labels name the series as well.
 * Primary brand teal stays #1E6A83 in light and #6FBBCE in dark.
 */

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

export const LIGHT_INKS: Record<AccentId, AccentInk> = {
  teal: { ink: '#1E6A83', onFill: '#FFFFFF' },
  amber: { ink: '#9A5B00', onFill: '#FFFFFF' },
  coral: { ink: '#C23B2E', onFill: '#FFFFFF' },
  violet: { ink: '#6D28D9', onFill: '#FFFFFF' },
  emerald: { ink: '#047857', onFill: '#FFFFFF' },
  sky: { ink: '#0369A1', onFill: '#FFFFFF' },
};

export const DARK_INKS: Record<AccentId, AccentInk> = {
  teal: { ink: '#6FBBCE', onFill: '#0B1417' },
  amber: { ink: '#F0C36A', onFill: '#0B1417' },
  coral: { ink: '#F0A090', onFill: '#0B1417' },
  violet: { ink: '#C4B5FD', onFill: '#0B1417' },
  emerald: { ink: '#6EE7B7', onFill: '#0B1417' },
  sky: { ink: '#7DD3FC', onFill: '#0B1417' },
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

export const LIGHT_CANVAS = '#FFFFFF';
export const LIGHT_PAGE = '#F4F6F6';
export const DARK_CANVAS = '#0B1417';
export const DARK_CARD = '#121E22';

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
