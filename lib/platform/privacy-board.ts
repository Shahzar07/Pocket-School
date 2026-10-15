/**
 * A leaderboard row that never shows an email or a full name to other people.
 * Opt out with `shareBoard: false`. A missing flag still appears, under a short name.
 */

export interface BoardPerson {
  id: string;
  name?: string | null;
  score: number;
  shareBoard?: boolean | null;
}

export interface BoardRow {
  id: string;
  label: string;
  score: number;
  isYou: boolean;
}

export function publicLabel(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed || trimmed.includes('@')) return 'Learner';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? 'Learner';
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1] ?? '';
  const initial = last.charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

export function privacyBoard(people: readonly BoardPerson[], viewerId: string | null): BoardRow[] {
  return [...people]
    .filter(person => person.shareBoard !== false)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map(person => ({
      id: person.id,
      label: person.id === viewerId ? 'You' : publicLabel(person.name),
      score: person.score,
      isYou: person.id === viewerId,
    }));
}
