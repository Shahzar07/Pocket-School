export interface FlowStep {
  id: string;
  label: string;
}

export function flowIndex<T extends { id: string }>(steps: readonly T[], currentId: string): number {
  const index = steps.findIndex((step) => step.id === currentId);
  return index < 0 ? 0 : index;
}

export function flowNeighbor<T extends { id: string }>(steps: readonly T[], currentId: string, direction: -1 | 1): T | null {
  const index = flowIndex(steps, currentId) + direction;
  if (index < 0 || index >= steps.length) return null;
  return steps[index] ?? null;
}

/** Earlier steps are always open. Later steps open only when the trail allows moving ahead. */
export function flowStepOpen(stepIndex: number, currentIndex: number, allowAhead: boolean): boolean {
  if (stepIndex < 0 || stepIndex === currentIndex) return false;
  return stepIndex < currentIndex || allowAhead;
}

/** Arrow keys move between items unless the user is typing. */
export function flowKeyTarget(
  event: { key: string; altKey: boolean; metaKey: boolean; ctrlKey: boolean; target: unknown },
  count: number,
  index: number,
): number | null {
  if (event.altKey || event.metaKey || event.ctrlKey) return null;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return null;
  const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = typeof target?.tagName === 'string' ? target.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return null;
  const next = index + (event.key === 'ArrowRight' ? 1 : -1);
  if (next < 0 || next >= count) return null;
  return next;
}
