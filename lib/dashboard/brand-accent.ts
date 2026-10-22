import type { AccentId } from '@/lib/design/chart-colours';

/** Dashboard series stay inside the brand blues. Coral and violet are not used. */
const BRAND_ACCENTS = ['teal', 'cyan', 'emerald', 'sky'] as const satisfies readonly AccentId[];

export function brandAccent(index: number): AccentId {
  const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return BRAND_ACCENTS[safe % BRAND_ACCENTS.length] ?? 'teal';
}
