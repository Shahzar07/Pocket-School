/** Reorder a list. The book studio uses it for chapter drag-and-drop. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}
