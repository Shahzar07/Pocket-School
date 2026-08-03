/**
 * Reporting periods shared by the student transcript and the teacher report-card
 * console, so a term means the same window on both sides of a report card.
 */

export const TERMS = [
  { id: 'all', label: 'All time' },
  { id: 't1', label: 'Term 1 (Jan–Mar)', startMonth: 0, endMonth: 2 },
  { id: 't2', label: 'Term 2 (Apr–Jun)', startMonth: 3, endMonth: 5 },
  { id: 't3', label: 'Term 3 (Jul–Sep)', startMonth: 6, endMonth: 8 },
  { id: 't4', label: 'Term 4 (Oct–Dec)', startMonth: 9, endMonth: 11 },
  { id: 'custom', label: 'Custom dates' },
] as const;

export type TermId = (typeof TERMS)[number]['id'];

export type DateRange = [Date, Date];

/** Resolve the selected term to a concrete window, or null meaning "all time". */
export function termRange(
  term: TermId, year: number, customFrom = '', customTo = '',
): DateRange | null {
  if (term === 'all') return null;
  if (term === 'custom') {
    if (!customFrom || !customTo) return null;
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T23:59:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    // Tolerate a reversed range rather than silently reporting nothing.
    return from <= to ? [from, to] : [to, from];
  }
  const t = TERMS.find(x => x.id === term) as { startMonth: number; endMonth: number } | undefined;
  if (!t) return null;
  return [
    new Date(year, t.startMonth, 1, 0, 0, 0),
    // Day 0 of the next month is the last day of this one.
    new Date(year, t.endMonth + 1, 0, 23, 59, 59),
  ];
}

/** Firestore Timestamp | Date | undefined → Date | null, without assuming a shape. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const ts = value as { toDate?: () => Date };
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate(); } catch { return null; }
  }
  return null;
}

/**
 * Is a timestamp inside the window? Undated records return true — dropping them
 * would silently understate a report card rather than merely mis-scope it.
 */
export function inRange(value: unknown, range: DateRange | null): boolean {
  if (!range) return true;
  const d = toDate(value);
  if (!d) return true;
  return d >= range[0] && d <= range[1];
}

export function formatPeriod(range: DateRange | null): string {
  if (!range) return 'All time';
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(range[0])} — ${fmt(range[1])}`;
}

/** Years offered in a period picker: this year and the five before it. */
export function selectableYears(count = 6): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => now - i);
}
