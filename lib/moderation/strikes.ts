import type { SafetySeverity } from './screen';

export type StrikeAction = 'none' | 'warning' | 'mute_24h' | 'mute_7d' | 'suspend';

const DAY = 24 * 60 * 60 * 1000;

export interface StrikeState {
  count: number;
  action: StrikeAction;
  mutedUntilMs: number | null;
  suspended: boolean;
}

export function nextStrike(count: number, severity: SafetySeverity, now: number): StrikeState {
  if (severity === 'none') {
    return { count, action: 'none', mutedUntilMs: null, suspended: false };
  }
  const next = count + 1;
  if (next <= 1) return { count: next, action: 'warning', mutedUntilMs: null, suspended: false };
  if (next === 2) return { count: next, action: 'mute_24h', mutedUntilMs: now + DAY, suspended: false };
  if (next === 3) return { count: next, action: 'mute_7d', mutedUntilMs: now + 7 * DAY, suspended: false };
  return { count: next, action: 'suspend', mutedUntilMs: null, suspended: true };
}

export function muteActive(mutedUntilMs: number | null, suspended: boolean, now: number): boolean {
  if (suspended) return true;
  return mutedUntilMs != null && mutedUntilMs > now;
}

export function strikeLabel(action: StrikeAction): string {
  if (action === 'warning') return 'Warning';
  if (action === 'mute_24h') return 'Posting paused for 24 hours';
  if (action === 'mute_7d') return 'Posting paused for 7 days';
  if (action === 'suspend') return 'Suspended pending admin review';
  return 'None';
}
