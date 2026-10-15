/**
 * Year placement and programme labels, shared by signup, onboarding and profile.
 * Programme names and year bands come from lib/programmes.ts (master brief).
 * `value` is what we store. `label` is what we show.
 */

import { PROGRAMMES, canonicalProgramme, tierForProgramme } from './programmes';

export interface YearGroupOption {
  value: string;
  label: string;
  /** Programme this year belongs to. */
  level: string;
}

export const YEAR_GROUPS: readonly YearGroupOption[] = PROGRAMMES.flatMap((programme) =>
  programme.years.map((year) => ({ value: year, label: year, level: programme.value })),
);

export const YEAR_GROUP_VALUES: readonly string[] = YEAR_GROUPS.map((y) => y.value);

export interface LevelOption {
  value: string;
  label: string;
}

/** Public programme names. No year numbers in the label. */
export const LEVELS: readonly LevelOption[] = PROGRAMMES.map((programme) => ({
  value: programme.value,
  label: programme.label,
}));

/** Older stored values, mapped onto the current programme names. */
export function canonicalLevel(value: string | null | undefined): string {
  return canonicalProgramme(value);
}

export function isYearGroup(value: string | null | undefined): boolean {
  return !!value && YEAR_GROUP_VALUES.includes(value);
}

export function levelForYear(year: string | null | undefined): string {
  return YEAR_GROUPS.find((y) => y.value === year)?.level ?? '';
}

export function levelLabel(value: string | null | undefined): string {
  if (!value) return '';
  const canonical = canonicalLevel(value);
  return LEVELS.find((l) => l.value === canonical)?.label ?? canonical;
}

export function yearLabel(value: string | null | undefined): string {
  if (!value) return '';
  return YEAR_GROUPS.find((y) => y.value === value)?.label ?? value;
}

/**
 * Access tier for a stored year or programme.
 * Primary and Lower Secondary are tier 1. IGCSE and A-Level are tier 2.
 * Micro Degree, Professional Certification and Independent Learning are tier 3.
 * LLB Law and MBBS Medicine are tier 4.
 */
export function tierForYear(year: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const programme = levelForYear(year) || canonicalLevel(year);
  return tierForProgramme(programme || year);
}
