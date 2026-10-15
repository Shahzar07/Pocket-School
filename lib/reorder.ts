/**
 * Order helpers for the course builder.
 * Drag-and-drop and the keyboard controls both call these, so a move lands
 * in the same place whichever way it was made.
 */

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function reorderById<T extends { id: string }>(items: readonly T[], fromId: string, toId: string): T[] {
  const from = items.findIndex(item => item.id === fromId);
  const to = items.findIndex(item => item.id === toId);
  if (from < 0 || to < 0) return [...items];
  return moveItem(items, from, to);
}

/** Insert `item` so it occupies `index`, clamped to the list. */
export function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  const next = [...items];
  const at = Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, item);
  return next;
}

/** 1-based order field written back to Firestore after a reorder. */
export function withSequentialOrder<T>(items: readonly T[]): (T & { order: number })[] {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export function sortByOrder<T extends { order?: number | null; title?: string | null; name?: string | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (a.name ?? a.title ?? '').localeCompare(b.name ?? b.title ?? '');
  });
}

export interface UndoEntry<T> {
  label: string;
  snapshot: T;
}

export function pushUndo<T>(stack: readonly UndoEntry<T>[], entry: UndoEntry<T>, limit = 30): UndoEntry<T>[] {
  return [entry, ...stack].slice(0, limit);
}

export function popUndo<T>(stack: readonly UndoEntry<T>[]): { entry: UndoEntry<T> | null; stack: UndoEntry<T>[] } {
  if (stack.length === 0) return { entry: null, stack: [] };
  const [entry, ...rest] = stack;
  return { entry, stack: rest };
}
