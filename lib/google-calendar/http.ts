import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { errorResponse, requireUser } from '@/lib/server-auth';
import { flagAbsences } from './absences';
import { asWorkspaceEvents, calendarDescription, ensurePoketCalendar, googleFreeBusy, googleListEvents, pushGoogleEvents } from './client';
import { feedSecret, googleCalendarConfigured, googleCalendarEnv, GOOGLE_CALENDAR_SCOPES, POKET_CALENDAR_NAME } from './config';
import { GOOGLE_CALENDAR_COPY } from './copy';
import { decryptRefreshToken, encryptRefreshToken } from './crypto';
import { blankStatus, filterByToggles, type GoogleCalendarStatus, type SyncEvent, type SyncToggles } from './events';
import { busyToUnavailable } from './freebusy';
import { EMPTY_ICS, feedUrl, newFeedNonce, signFeedToken } from './ical-link';
import { exchangeAuthCode, googleAuthUrl, refreshAccessToken, signOAuthState, verifyOAuthState } from './oauth';
import {
  deleteConnection,
  loadConnection,
  loadFeed,
  loadWorkspace,
  saveConnection,
  saveFeed,
  saveWorkspace,
  userCanManageWorkspace,
  type CalendarConnection,
} from './store';
import { importWorkspaceEvents, type WorkspaceSourceEvent } from './workspace';

const STATE_COOKIE = 'ps_gcal_state';

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

async function signedIn(req: NextRequest): Promise<{ uid: string } | Response> {
  try {
    return await requireUser(req);
  } catch (err) {
    return errorResponse(err);
  }
}

function isResponse(value: { uid: string } | Response): value is Response {
  return value instanceof Response;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function html(message: string): NextResponse {
  const safe = escapeHtml(message);
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><title>Poket School</title></head><body><p>${safe}</p><p><a href="/dashboard/calendar">Back to the calendar</a></p></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function asEvents(value: unknown): SyncEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<SyncEvent>;
    if (!row.sourceId || !row.title || !row.date || !row.kind) return [];
    if (row.kind !== 'timetable' && row.kind !== 'cover' && row.kind !== 'exam' && row.kind !== 'assignment' && row.kind !== 'planner') return [];
    return [{
      sourceId: row.sourceId,
      kind: row.kind,
      title: row.title,
      date: row.date,
      endDate: row.endDate,
      startTime: row.startTime,
      endTime: row.endTime,
      description: row.description,
    }];
  });
}

function togglesFrom(value: unknown, fallback: SyncToggles): SyncToggles {
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Partial<SyncToggles>;
  return {
    timetable: typeof row.timetable === 'boolean' ? row.timetable : fallback.timetable,
    cover: typeof row.cover === 'boolean' ? row.cover : fallback.cover,
    exams: typeof row.exams === 'boolean' ? row.exams : fallback.exams,
    assignments: typeof row.assignments === 'boolean' ? row.assignments : fallback.assignments,
    planner: typeof row.planner === 'boolean' ? row.planner : fallback.planner,
  };
}

async function statusFor(req: NextRequest, uid: string | null): Promise<GoogleCalendarStatus> {
  const env = googleCalendarEnv();
  const configured = googleCalendarConfigured(env);
  const status = blankStatus(configured, env.clientId);
  if (!uid) return status;
  status.signedIn = true;
  const [connection, feed] = await Promise.all([
    loadConnection(uid),
    loadFeed(uid),
  ]);
  if (feed?.nonce) {
    status.feedUrl = feedUrl(req.nextUrl.origin, signFeedToken(uid, feed.nonce, feedSecret()));
  }
  if (!connection?.encryptedRefreshToken) return status;
  status.connected = true;
  status.toggles = connection.toggles;
  status.freeBusyOptIn = connection.freeBusyOptIn;
  status.absenceKeyword = connection.absenceKeyword;
  status.absenceCalendarId = connection.absenceCalendarId;
  status.lastSyncAt = connection.lastSyncAt;
  status.lastError = connection.lastError;
  if (await userCanManageWorkspace(uid)) {
    const institutionId = req.nextUrl.searchParams.get('institutionId') ?? '';
    const workspace = institutionId ? await loadWorkspace(institutionId) : null;
    status.workspace = {
      connected: Boolean(workspace?.encryptedRefreshToken),
      roomCalendarId: workspace?.roomCalendarId ?? '',
      eventsCalendarId: workspace?.eventsCalendarId ?? '',
      lastSyncAt: workspace?.lastSyncAt ?? null,
      lastError: workspace?.lastError ?? null,
    };
  }
  return status;
}

async function accessFor(connection: CalendarConnection): Promise<{ accessToken: string } | { error: string }> {
  const env = googleCalendarEnv();
  const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken, env.clientSecret);
  return refreshAccessToken({ refreshToken, clientId: env.clientId, clientSecret: env.clientSecret });
}

async function rememberFeed(req: NextRequest, uid: string, ics: string, regenerate: boolean): Promise<string> {
  const existing = await loadFeed(uid);
  const nonce = regenerate || !existing?.nonce ? newFeedNonce() : existing.nonce;
  const row = {
    uid,
    nonce,
    ics: ics || existing?.ics || EMPTY_ICS,
    updatedAt: new Date().toISOString(),
  };
  await saveFeed(row);
  return feedUrl(req.nextUrl.origin, signFeedToken(uid, nonce, feedSecret()));
}

async function finishConnect(uid: string, code: string, redirectUri: string, audience: string): Promise<NextResponse> {
  const env = googleCalendarEnv();
  if (!googleCalendarConfigured(env)) return json({ configured: false, error: GOOGLE_CALENDAR_COPY.notConfigured }, 503);
  if (!isAdminConfigured()) return json({ error: 'Google Calendar needs the server account tools before a connection can be saved.' }, 503);
  const tokens = await exchangeAuthCode({ code, clientId: env.clientId, clientSecret: env.clientSecret, redirectUri });
  if ('error' in tokens) return json({ error: tokens.error }, 400);
  const calendarId = await ensurePoketCalendar({
    accessToken: tokens.accessToken,
    description: calendarDescription(audience),
  });
  const previous = await loadConnection(uid);
  await saveConnection({
    uid,
    encryptedRefreshToken: encryptRefreshToken(tokens.refreshToken, env.clientSecret),
    calendarId,
    audience,
    scopes: [...GOOGLE_CALENDAR_SCOPES],
    connectedAt: new Date().toISOString(),
    lastSyncAt: previous?.lastSyncAt ?? null,
    lastError: null,
    toggles: previous?.toggles ?? blankStatus(true).toggles,
    freeBusyOptIn: previous?.freeBusyOptIn ?? false,
    absenceCalendarId: previous?.absenceCalendarId ?? '',
    absenceKeyword: previous?.absenceKeyword ?? 'leave',
    pushedIds: previous?.pushedIds ?? [],
  });
  return json({ connected: true, calendarName: POKET_CALENDAR_NAME });
}

export async function handleGoogleCalendar(action: string, req: NextRequest): Promise<Response> {
  if (action === 'status' && req.method === 'GET') {
    const header = req.headers.get('authorization') ?? '';
    if (!header) return json(await statusFor(req, null));
    const user = await signedIn(req);
    if (isResponse(user)) return json(await statusFor(req, null));
    return json(await statusFor(req, user.uid));
  }

  if (action === 'connect' && req.method === 'GET') {
    const env = googleCalendarEnv();
    if (!googleCalendarConfigured(env)) return json({ configured: false, error: GOOGLE_CALENDAR_COPY.notConfigured });
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    if (!rateLimit(`gcal-connect:${user.uid}`, 20, 60_000)) return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
    const state = signOAuthState(user.uid, env.clientSecret);
    const url = googleAuthUrl({ clientId: env.clientId, redirectUri: env.redirectUri, state });
    const response = json({ configured: true, url, clientId: env.clientId });
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    });
    return response;
  }

  if (action === 'callback' && req.method === 'GET') {
    const env = googleCalendarEnv();
    const code = req.nextUrl.searchParams.get('code') ?? '';
    const state = req.nextUrl.searchParams.get('state') ?? '';
    const cookie = req.cookies.get(STATE_COOKIE)?.value ?? '';
    const verified = verifyOAuthState(state, env.clientSecret);
    if (!code || !verified || cookie !== state) return html('This Google Calendar connection expired. Start again from Poket School.');
    try {
      const result = await finishConnect(verified.uid, code, env.redirectUri, 'teacher');
      const body = await result.json() as { error?: string; connected?: boolean };
      if (!result.ok) return html(body.error || GOOGLE_CALENDAR_COPY.connectFailed);
      const page = html('Poket School calendar connected.');
      page.cookies.set(STATE_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
      return page;
    } catch (err) {
      return html(err instanceof Error ? err.message : GOOGLE_CALENDAR_COPY.connectFailed);
    }
  }

  if (action === 'exchange' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    const body = await req.json().catch(() => ({})) as { code?: string; audience?: string };
    if (!body.code) return json({ error: GOOGLE_CALENDAR_COPY.connectFailed }, 400);
    const audience = body.audience === 'parent' || body.audience === 'student' || body.audience === 'admin' ? body.audience : 'teacher';
    try {
      return await finishConnect(user.uid, body.code, 'postmessage', audience);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : GOOGLE_CALENDAR_COPY.connectFailed }, 502);
    }
  }

  if (action === 'settings' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    const connection = await loadConnection(user.uid);
    if (!connection) return json({ error: GOOGLE_CALENDAR_COPY.connect }, 400);
    const body = await req.json().catch(() => ({})) as {
      toggles?: unknown;
      freeBusyOptIn?: boolean;
      absenceKeyword?: string;
      absenceCalendarId?: string;
      audience?: string;
    };
    connection.toggles = togglesFrom(body.toggles, connection.toggles);
    if (typeof body.freeBusyOptIn === 'boolean') connection.freeBusyOptIn = body.freeBusyOptIn;
    if (typeof body.absenceKeyword === 'string') connection.absenceKeyword = body.absenceKeyword.slice(0, 40) || 'leave';
    if (typeof body.absenceCalendarId === 'string') connection.absenceCalendarId = body.absenceCalendarId.slice(0, 200);
    if (body.audience === 'parent' || body.audience === 'student' || body.audience === 'teacher' || body.audience === 'admin') {
      connection.audience = body.audience;
    }
    await saveConnection(connection);
    return json({ saved: true });
  }

  if (action === 'disconnect' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    await deleteConnection(user.uid);
    return json({ connected: false });
  }

  if (action === 'feed' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    const body = await req.json().catch(() => ({})) as { ics?: string; regenerate?: boolean };
    const url = await rememberFeed(req, user.uid, typeof body.ics === 'string' ? body.ics : '', body.regenerate === true);
    return json({ url });
  }

  if (action === 'sync' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    const env = googleCalendarEnv();
    const body = await req.json().catch(() => ({})) as { events?: unknown; ics?: string; audience?: string };
    let url: string | null = null;
    if (typeof body.ics === 'string' && body.ics.includes('BEGIN:VCALENDAR')) {
      url = await rememberFeed(req, user.uid, body.ics, false);
    }
    if (!googleCalendarConfigured(env)) {
      return json({ configured: false, synced: false, feedUrl: url, error: GOOGLE_CALENDAR_COPY.notConfigured });
    }
    const connection = await loadConnection(user.uid);
    if (!connection) return json({ configured: true, connected: false, synced: false, feedUrl: url });
    try {
      const access = await accessFor(connection);
      if ('error' in access) throw new Error(access.error);
      const audience = body.audience === 'parent' || body.audience === 'student' ? body.audience : connection.audience;
      const calendarId = await ensurePoketCalendar({
        accessToken: access.accessToken,
        existingId: connection.calendarId,
        description: calendarDescription(audience),
      });
      const result = await pushGoogleEvents({
        accessToken: access.accessToken,
        calendarId,
        events: filterByToggles(asEvents(body.events), connection.toggles),
        previousIds: connection.pushedIds,
      });
      connection.calendarId = calendarId;
      connection.pushedIds = result.ids;
      connection.lastSyncAt = new Date().toISOString();
      connection.lastError = null;
      await saveConnection(connection);
      return json({
        configured: true,
        synced: true,
        upserted: result.upserted,
        deleted: result.deleted,
        calendar: POKET_CALENDAR_NAME,
        feedUrl: url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Calendar sync failed.';
      connection.lastError = message;
      await saveConnection(connection).catch(() => undefined);
      return json({ error: message, feedUrl: url }, 502);
    }
  }

  if (action === 'pull' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    const connection = await loadConnection(user.uid);
    if (!connection) return json({ optIn: false, applied: false, slots: [], absences: [] });
    const body = await req.json().catch(() => ({})) as {
      periods?: { id: string; start: string; end: string }[];
      anchorMonday?: string;
    };
    try {
      const access = await accessFor(connection);
      if ('error' in access) throw new Error(access.error);
      const anchor = body.anchorMonday || new Date().toISOString().slice(0, 10);
      const timeMin = `${anchor}T00:00:00+08:00`;
      const end = new Date(`${anchor}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 5);
      const timeMax = `${end.toISOString().slice(0, 10)}T00:00:00+08:00`;
      const slots = connection.freeBusyOptIn
        ? busyToUnavailable(await googleFreeBusy({ accessToken: access.accessToken, timeMin, timeMax }), body.periods ?? [], anchor)
        : [];
      const calendars = ['primary', connection.absenceCalendarId].filter((id, index, list) => id && list.indexOf(id) === index);
      const listed = (await Promise.all(calendars.map(calendarId => googleListEvents({
        accessToken: access.accessToken,
        calendarId,
        timeMin,
        timeMax,
      })))).flat();
      const absences = flagAbsences(listed, { keyword: connection.absenceKeyword, absenceCalendarId: connection.absenceCalendarId });
      return json({ optIn: connection.freeBusyOptIn, applied: false, slots, absences });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Google Calendar could not be read.', applied: false, slots: [], absences: [] }, 502);
    }
  }

  if (action === 'workspace' && req.method === 'POST') {
    const user = await signedIn(req);
    if (isResponse(user)) return user;
    if (!await userCanManageWorkspace(user.uid)) return json({ error: 'An admin connects the school Google calendars.' }, 403);
    const env = googleCalendarEnv();
    if (!googleCalendarConfigured(env)) return json({ configured: false, error: GOOGLE_CALENDAR_COPY.notConfigured }, 503);
    const body = await req.json().catch(() => ({})) as {
      institutionId?: string;
      roomCalendarId?: string;
      eventsCalendarId?: string;
      periods?: { id: string; start: string; end: string }[];
      rooms?: { id: string; name: string }[];
      events?: WorkspaceSourceEvent[];
    };
    const institutionId = (body.institutionId || 'school').slice(0, 120);
    const personal = await loadConnection(user.uid);
    if (!personal) return json({ error: GOOGLE_CALENDAR_COPY.connect }, 400);
    const existing = await loadWorkspace(institutionId);
    const row = {
      institutionId,
      encryptedRefreshToken: personal.encryptedRefreshToken,
      roomCalendarId: typeof body.roomCalendarId === 'string' ? body.roomCalendarId : existing?.roomCalendarId ?? '',
      eventsCalendarId: typeof body.eventsCalendarId === 'string' ? body.eventsCalendarId : existing?.eventsCalendarId ?? '',
      connectedBy: user.uid,
      lastSyncAt: existing?.lastSyncAt ?? null,
      lastError: null as string | null,
    };
    try {
      let source = Array.isArray(body.events) ? body.events : [];
      if (source.length === 0) {
        const access = await accessFor(personal);
        if ('error' in access) throw new Error(access.error);
        const timeMin = new Date().toISOString();
        const later = new Date(Date.now() + 1000 * 60 * 60 * 24 * 370).toISOString();
        const roomEvents = row.roomCalendarId
          ? await googleListEvents({ accessToken: access.accessToken, calendarId: row.roomCalendarId, timeMin, timeMax: later })
          : [];
        const schoolEvents = row.eventsCalendarId
          ? await googleListEvents({ accessToken: access.accessToken, calendarId: row.eventsCalendarId, timeMin, timeMax: later })
          : [];
        source = [
          ...asWorkspaceEvents(roomEvents, 'rooms'),
          ...asWorkspaceEvents(schoolEvents, 'school'),
        ];
      }
      const imported = importWorkspaceEvents(source, body.periods ?? [], body.rooms ?? []);
      row.lastSyncAt = new Date().toISOString();
      await saveWorkspace(row);
      return json({ imported, calendar: POKET_CALENDAR_NAME });
    } catch (err) {
      row.lastError = err instanceof Error ? err.message : 'The school calendars could not be imported.';
      await saveWorkspace(row).catch(() => undefined);
      return json({ error: row.lastError }, 502);
    }
  }

  return json({ error: 'Unknown Google Calendar action.' }, 404);
}
