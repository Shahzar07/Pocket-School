/** Local calendar key. Goals and attendance are a "today" idea, not UTC midnight. */
export function isoDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return isoDateKey(d);
}

export function dateKeysBetween(start: string, end: string, cap = 400): string[] {
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end && out.length < cap) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function weekdayOf(key: string): number {
  return parseDateKey(key).getDay();
}
