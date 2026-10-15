export interface QuietWindow {
  start: string;
  end: string;
  timeZone: string;
}

const CLOCK = /^(\d{2}):(\d{2})$/;

export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesInZone(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

export function isWithinQuietHours(now: Date, window: QuietWindow | null): boolean {
  if (!window) return false;
  const start = parseClock(window.start);
  const end = parseClock(window.end);
  const current = minutesInZone(now, window.timeZone);
  if (start === null || end === null || current === null || start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

/** When a held message should become visible: the next time quiet hours end. */
export function nextVisibleAt(now: Date, window: QuietWindow): Date | null {
  if (!isWithinQuietHours(now, window)) return null;
  const end = parseClock(window.end);
  const current = minutesInZone(now, window.timeZone);
  if (end === null || current === null) return null;
  const delta = current < end ? end - current : (24 * 60 - current) + end;
  return new Date(now.getTime() + delta * 60_000);
}
