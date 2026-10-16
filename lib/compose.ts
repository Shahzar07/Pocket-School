export type DeliveryChannel = 'in_app' | 'email' | 'push';

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { text: string; cursor: number } {
  const selected = text.slice(start, end) || 'text';
  const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  return { text: next, cursor: start + before.length + selected.length + after.length };
}

/** Future timestamps wait. Anything else sends with the in-app post. */
export function deliveryWhen(iso: string, now = Date.now()): 'now' | 'later' {
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || at <= now) return 'now';
  return 'later';
}
