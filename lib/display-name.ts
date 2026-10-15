/**
 * Name safe to show to other students (leaderboards, class lists that aren't the teacher).
 * "Harry Seggu" → "Harry S." A single name is left as-is.
 */
export function publicDisplayName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Student';
  const first = parts[0] ?? 'Student';
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1] ?? '';
  const initial = last.charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

/** Greeting name: the first word, not the whole legal name. */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'there';
}
