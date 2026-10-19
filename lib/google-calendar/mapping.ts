import { createHash } from 'node:crypto';
import { SCHOOL_TIME_ZONE } from './config';
import type { SyncEvent } from './events';

export interface GoogleEventBody {
  id: string;
  summary: string;
  description: string;
  start: { date?: string; dateTime?: string; timeZone: string };
  end: { date?: string; dateTime?: string; timeZone: string };
}

/** Google event ids are base32hex. Hex is inside that alphabet, so the id stays stable and legal. */
export function googleEventId(sourceId: string): string {
  const hex = createHash('sha256').update(`poket:${sourceId}`).digest('hex');
  return `poket${hex.slice(0, 40)}`;
}

function nextDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const stamp = new Date(Date.UTC(year || 2026, (month || 1) - 1, (day || 1) + 1));
  return stamp.toISOString().slice(0, 10);
}

export function toGoogleEvent(event: SyncEvent, timeZone = SCHOOL_TIME_ZONE): GoogleEventBody {
  const id = googleEventId(event.sourceId);
  const timed = Boolean(event.startTime && event.endTime);
  if (!timed) {
    const end = nextDate(event.endDate && event.endDate >= event.date ? event.endDate : event.date);
    return {
      id,
      summary: event.title,
      description: event.description ?? '',
      start: { date: event.date, timeZone },
      end: { date: end, timeZone },
    };
  }
  return {
    id,
    summary: event.title,
    description: event.description ?? '',
    start: { dateTime: `${event.date}T${event.startTime}:00`, timeZone },
    end: { dateTime: `${event.date}T${event.endTime}:00`, timeZone },
  };
}

export interface SyncPlan {
  upserts: GoogleEventBody[];
  deletes: string[];
}

/**
 * Same source id always maps to the same Google id.
 * A second plan against the ids just written has nothing to delete.
 * A source that disappeared is deleted once, and is not inserted again.
 */
export function planSync(events: SyncEvent[], previousIds: string[], timeZone = SCHOOL_TIME_ZONE): SyncPlan {
  const byId = new Map<string, GoogleEventBody>();
  for (const event of events) byId.set(googleEventId(event.sourceId), toGoogleEvent(event, timeZone));
  const upserts = [...byId.values()];
  const next = new Set(upserts.map(item => item.id));
  const deletes = [...new Set(previousIds.filter(id => !next.has(id)))];
  return { upserts, deletes };
}
