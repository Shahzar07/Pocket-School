import type { ContentRevision } from './types';

/** Keep a short history. Identical neighbours are not stored twice. */
export function pushRevision<T>(list: ContentRevision<T>[], value: T, label: string, limit = 12): ContentRevision<T>[] {
  const serial = JSON.stringify(value);
  if (list[0] && JSON.stringify(list[0].value) === serial) return list;
  const next: ContentRevision<T> = { id: `${Date.now()}`, at: Date.now(), label, value };
  return [next, ...list].slice(0, limit);
}
