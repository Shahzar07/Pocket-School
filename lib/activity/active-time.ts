/**
 * Active study time. Hidden tabs, a switched-away window, and idle time
 * do not count. The mobile app should treat AppState the same way:
 * `active` can count, `background` and `inactive` are hidden.
 */

export const DEFAULT_IDLE_MINUTES = 5;
export const HEARTBEAT_MS = 60_000;

export type Presence = 'active' | 'idle' | 'hidden';

export interface DayActivity {
  dateKey: string;
  activeMs: number;
  idleMs: number;
  hiddenMs: number;
}

export function idleMinutes(value: unknown): number {
  const minutes = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_IDLE_MINUTES;
  return Math.min(60, Math.max(1, minutes));
}

export function presenceOf(input: {
  visible: boolean;
  focused: boolean;
  lastInputAt: number;
  now: number;
  idleMs: number;
}): Presence {
  if (!input.visible || !input.focused) return 'hidden';
  if (input.now - input.lastInputAt >= input.idleMs) return 'idle';
  return 'active';
}

export function countsForProgress(presence: Presence): boolean {
  return presence === 'active';
}

export function emptyDay(dateKey: string): DayActivity {
  return { dateKey, activeMs: 0, idleMs: 0, hiddenMs: 0 };
}

export function addSlice(day: DayActivity, presence: Presence, ms: number): DayActivity {
  const delta = Math.max(0, Math.round(ms));
  if (presence === 'active') return { ...day, activeMs: day.activeMs + delta };
  if (presence === 'idle') return { ...day, idleMs: day.idleMs + delta };
  return { ...day, hiddenMs: day.hiddenMs + delta };
}

export function shouldFlush(lastFlushAt: number, now: number, heartbeatMs = HEARTBEAT_MS): boolean {
  return now - lastFlushAt >= heartbeatMs;
}

export function minutesOf(ms: number): number {
  return Math.round(ms / 60_000);
}

export function streakFromActiveDays(days: readonly { dateKey: string; activeMs: number }[], today: string): number {
  const credited = new Set(days.filter((day) => day.activeMs >= 60_000).map((day) => day.dateKey));
  let cursor = today;
  let count = 0;
  while (credited.has(cursor)) {
    count += 1;
    cursor = previousDate(cursor);
  }
  return count;
}

export function creditStudyDate(dates: readonly string[], dateKey: string, activeMs: number): string[] {
  if (activeMs < 60_000 || dates.includes(dateKey)) return [...dates];
  return [...dates, dateKey].slice(-400);
}

export const ACTIVE_TIME_COPY = 'Only active time counts. Time with the tab hidden, another app in front, or no taps for a few minutes is left out of progress, goals, streaks, and Sparks.';

function previousDate(iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return '';
  return new Date(ms - 86_400_000).toISOString().slice(0, 10);
}
