import { POKET_CALENDAR_NAME, SCHOOL_TIME_ZONE } from './config';
import type { AbsenceEvent } from './absences';
import type { BusyInterval } from './freebusy';
import { planSync, type GoogleEventBody } from './mapping';
import type { SyncEvent } from './events';
import type { WorkspaceSourceEvent } from './workspace';

const API = 'https://www.googleapis.com/calendar/v3';

type FetchImpl = typeof fetch;

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

async function googleMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof json.error === 'string') return json.error;
    if (json.error && typeof json.error === 'object' && json.error.message) return json.error.message;
  } catch {
    /* Google sometimes returns plain text. */
  }
  return text.slice(0, 180) || `Google Calendar returned ${response.status}`;
}

export async function ensurePoketCalendar(input: {
  fetchImpl?: FetchImpl;
  accessToken: string;
  existingId?: string;
  description: string;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  if (input.existingId) {
    const current = await fetchImpl(`${API}/calendars/${encodeURIComponent(input.existingId)}`, {
      headers: authHeaders(input.accessToken),
    });
    if (current.ok) return input.existingId;
  }
  const list = await fetchImpl(`${API}/users/me/calendarList`, { headers: authHeaders(input.accessToken) });
  if (list.ok) {
    const json = await list.json() as { items?: { id?: string; summary?: string }[] };
    const found = json.items?.find(item => item.summary === POKET_CALENDAR_NAME && item.id);
    if (found?.id) return found.id;
  }
  const created = await fetchImpl(`${API}/calendars`, {
    method: 'POST',
    headers: authHeaders(input.accessToken),
    body: JSON.stringify({ summary: POKET_CALENDAR_NAME, description: input.description, timeZone: SCHOOL_TIME_ZONE }),
  });
  if (!created.ok) throw new Error(await googleMessage(created));
  const body = await created.json() as { id?: string };
  if (!body.id) throw new Error('Google Calendar did not create the Poket School calendar.');
  return body.id;
}

async function upsertOne(fetchImpl: FetchImpl, accessToken: string, calendarId: string, event: GoogleEventBody): Promise<void> {
  const url = `${API}/calendars/${encodeURIComponent(calendarId)}/events/${event.id}`;
  const patch = await fetchImpl(url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ summary: event.summary, description: event.description, start: event.start, end: event.end }),
  });
  if (patch.ok) return;
  if (patch.status !== 404) throw new Error(await googleMessage(patch));
  const inserted = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(event),
  });
  if (!inserted.ok) throw new Error(await googleMessage(inserted));
}

async function deleteOne(fetchImpl: FetchImpl, accessToken: string, calendarId: string, id: string): Promise<void> {
  const response = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (response.ok || response.status === 404 || response.status === 410) return;
  throw new Error(await googleMessage(response));
}

/** Inserts missing events, patches existing ids, and deletes ids that left the feed. */
export async function pushGoogleEvents(input: {
  fetchImpl?: FetchImpl;
  accessToken: string;
  calendarId: string;
  events: SyncEvent[];
  previousIds: string[];
}): Promise<{ upserted: number; deleted: number; ids: string[] }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const plan = planSync(input.events, input.previousIds);
  for (const event of plan.upserts) await upsertOne(fetchImpl, input.accessToken, input.calendarId, event);
  for (const id of plan.deletes) await deleteOne(fetchImpl, input.accessToken, input.calendarId, id);
  return { upserted: plan.upserts.length, deleted: plan.deletes.length, ids: plan.upserts.map(event => event.id) };
}

export async function googleFreeBusy(input: {
  fetchImpl?: FetchImpl;
  accessToken: string;
  timeMin: string;
  timeMax: string;
  calendarId?: string;
}): Promise<BusyInterval[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const calendarId = input.calendarId || 'primary';
  const response = await fetchImpl(`${API}/freeBusy`, {
    method: 'POST',
    headers: authHeaders(input.accessToken),
    body: JSON.stringify({ timeMin: input.timeMin, timeMax: input.timeMax, items: [{ id: calendarId }] }),
  });
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = await response.json() as { calendars?: Record<string, { busy?: BusyInterval[] }> };
  return json.calendars?.[calendarId]?.busy ?? [];
}

interface GoogleEventJson {
  id?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

function eventDate(value?: { date?: string; dateTime?: string }): { date: string; time?: string } {
  if (value?.date) return { date: value.date };
  if (value?.dateTime) return { date: value.dateTime.slice(0, 10), time: value.dateTime.slice(11, 16) };
  return { date: '' };
}

export async function googleListEvents(input: {
  fetchImpl?: FetchImpl;
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<Array<AbsenceEvent & { endDate?: string; startTime?: string; endTime?: string; summary: string }>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    singleEvents: 'true',
    maxResults: '250',
  });
  const response = await fetchImpl(`${API}/calendars/${encodeURIComponent(input.calendarId)}/events?${params.toString()}`, {
    headers: authHeaders(input.accessToken),
  });
  if (!response.ok) throw new Error(await googleMessage(response));
  const json = await response.json() as { items?: GoogleEventJson[] };
  return (json.items ?? []).flatMap(item => {
    const start = eventDate(item.start);
    if (!item.id || !start.date) return [];
    const end = eventDate(item.end);
    return [{
      id: item.id,
      summary: item.summary ?? '',
      date: start.date,
      calendarId: input.calendarId,
      startTime: start.time,
      endTime: end.time,
      endDate: end.date && end.date !== start.date ? end.date : undefined,
    }];
  });
}

export function asWorkspaceEvents(
  events: Array<AbsenceEvent & { endDate?: string; startTime?: string; endTime?: string }>,
  calendar: 'rooms' | 'school',
): WorkspaceSourceEvent[] {
  return events.map(event => ({
    id: event.id,
    summary: event.summary,
    date: event.date,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    calendar,
  }));
}

export function calendarDescription(audience: string): string {
  if (audience === 'parent') return "Your child's Poket School timetable.";
  if (audience === 'student') return 'Your Poket School timetable.';
  if (audience === 'teacher') return 'Your Poket School teaching timetable.';
  return 'Poket School timetable.';
}
