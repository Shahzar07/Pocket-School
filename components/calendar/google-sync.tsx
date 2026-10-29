'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';
import { GOOGLE_CALENDAR_COPY } from '@/lib/google-calendar/copy';
import { blankStatus, filterByToggles, type GoogleCalendarStatus, type SyncEvent, type SyncKind, type SyncToggles } from '@/lib/google-calendar/events';
import type { WorkspaceImport } from '@/lib/google-calendar/workspace';

type CodeResponse = { code?: string };

type CodeClient = { requestCode: () => void };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            callback: (response: CodeResponse) => void;
          }) => CodeClient;
        };
      };
    };
  }
}

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
/** Blue on white in light mode. Mist on ink in dark mode so the note stays AA. */
const onInk = 'text-[#1E6A83] dark:text-[#E7F4F2]';
const outline = 'h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83] dark:border-[#E7F4F2]/40 dark:text-[#E7F4F2]';
/** Light mode stays faded. Dark mode uses a quieter mist that still clears AA on #122226. */
const outlineMuted = `${outline} disabled:opacity-50 dark:disabled:opacity-100 dark:disabled:border-[#8FB8B4] dark:disabled:text-[#8FB8B4]`;

async function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gis'));
    document.head.appendChild(script);
  });
}

export function GoogleCalendarSync({
  source,
  events,
  ics,
  audience = 'teacher',
  manageWorkspace = false,
  institutionId = '',
  periods = [],
  rooms = [],
  anchorMonday = '',
  onConstraints,
  onAbsences,
  onWorkspace,
}: {
  source: 'timetable' | 'calendar' | 'planner';
  events: SyncEvent[];
  ics: string;
  audience?: 'teacher' | 'student' | 'parent' | 'admin';
  manageWorkspace?: boolean;
  institutionId?: string;
  periods?: { id: string; start: string; end: string }[];
  rooms?: { id: string; name: string }[];
  anchorMonday?: string;
  onConstraints?: (slots: string[]) => void;
  onAbsences?: (items: { date: string; reason: 'absent' | 'leave'; title: string; applied: false }[]) => void;
  onWorkspace?: (imported: WorkspaceImport) => void;
}) {
  const [status, setStatus] = useState<GoogleCalendarStatus>(() => blankStatus(false));
  const [message, setMessage] = useState('');
  const [absences, setAbsences] = useState<{ date: string; reason: 'absent' | 'leave'; title: string; applied: false }[]>([]);
  const [roomCalendarId, setRoomCalendarId] = useState('');
  const [eventsCalendarId, setEventsCalendarId] = useState('');
  const [keyword, setKeyword] = useState('leave');
  const [absenceCalendarId, setAbsenceCalendarId] = useState('');

  const load = () => {
    const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : '';
    authedFetch(`/api/google-calendar/status${query}`)
      .then(async (response) => {
        const next = (await response.json()) as GoogleCalendarStatus;
        setStatus(next);
        setKeyword(next.absenceKeyword || 'leave');
        setAbsenceCalendarId(next.absenceCalendarId || '');
        setRoomCalendarId(next.workspace?.roomCalendarId ?? '');
        setEventsCalendarId(next.workspace?.eventsCalendarId ?? '');
      })
      .catch(() => setStatus(blankStatus(false)));
  };

  useEffect(() => { load(); }, [institutionId]);

  const post = async (action: string, body: unknown) => {
    const response = await authedFetch(`/api/google-calendar/${action}`, { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})) as {
      error?: string;
      url?: string;
      upserted?: number;
      deleted?: number;
      calendar?: string;
      slots?: string[];
      absences?: { date: string; reason: 'absent' | 'leave'; title: string; applied: false }[];
      imported?: WorkspaceImport;
      feedUrl?: string | null;
      configured?: boolean;
    };
    if (!response.ok && data.error) setMessage(data.error);
    return { response, data };
  };

  const connect = async () => {
    if (!status.configured || !status.clientId) return;
    try {
      await loadGis();
      const client = window.google?.accounts?.oauth2?.initCodeClient({
        client_id: status.clientId,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: (code) => {
          if (!code.code) {
            setMessage(GOOGLE_CALENDAR_COPY.connectFailed);
            return;
          }
          void post('exchange', { code: code.code, audience }).then(() => load());
        },
      });
      client?.requestCode();
    } catch {
      const response = await authedFetch('/api/google-calendar/connect');
      const data = await response.json().catch(() => ({})) as { url?: string };
      if (data.url) window.location.href = data.url;
      else setMessage(GOOGLE_CALENDAR_COPY.connectFailed);
    }
  };

  const sync = async () => {
    const filtered = filterByToggles(events, status.toggles);
    const { response, data } = await post('sync', { events: filtered, ics, audience });
    if (response.status === 401) {
      setMessage(GOOGLE_CALENDAR_COPY.signIn);
      return;
    }
    if (data.calendar) {
      setMessage(`${GOOGLE_CALENDAR_COPY.synced}`);
      setStatus(current => ({ ...current, lastSyncAt: new Date().toISOString(), lastError: null, feedUrl: data.feedUrl ?? current.feedUrl }));
    }
    load();
  };

  const saveSettings = async (toggles: SyncToggles, freeBusyOptIn: boolean) => {
    setStatus(current => ({ ...current, toggles, freeBusyOptIn }));
    await post('settings', { toggles, freeBusyOptIn, absenceKeyword: keyword, absenceCalendarId, audience });
    setMessage(GOOGLE_CALENDAR_COPY.saved);
  };

  const pull = async (optIn: boolean) => {
    await saveSettings(status.toggles, optIn);
    const { data } = await post('pull', { periods, anchorMonday });
    setAbsences(data.absences ?? []);
    if (optIn && data.slots) onConstraints?.(data.slots);
    if (data.absences) onAbsences?.(data.absences);
  };

  const kindLabel: Record<SyncKind, string> = {
    timetable: GOOGLE_CALENDAR_COPY.timetable,
    cover: GOOGLE_CALENDAR_COPY.cover,
    exam: GOOGLE_CALENDAR_COPY.exams,
    assignment: GOOGLE_CALENDAR_COPY.assignments,
    planner: GOOGLE_CALENDAR_COPY.planner,
  };

  return (
    <section className="space-y-3 rounded-3xl border border-[#1E6A83]/20 bg-white p-4 text-[#203337] dark:border-[#3FE0D0]/25 dark:bg-[#122226] dark:text-[#E7F4F2]" data-google-sync={source} data-google-state={status.configured ? (status.connected ? 'connected' : 'ready') : 'unconfigured'}>
      <h2 className="font-semibold">{GOOGLE_CALENDAR_COPY.calendarName}</h2>
      {status.configured ? null : <p data-google-unconfigured="1">{GOOGLE_CALENDAR_COPY.notConfigured}</p>}
      {status.configured && !status.connected ? (
        <button type="button" className="h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" data-action="google-connect" onClick={() => void connect()}>{GOOGLE_CALENDAR_COPY.connect}</button>
      ) : null}
      <button type="button" className={outlineMuted} data-action="google-sync" disabled={!status.connected} onClick={() => void sync()}>{GOOGLE_CALENDAR_COPY.sync}</button>
      {status.connected ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{GOOGLE_CALENDAR_COPY.types}</p>
          {(Object.keys(kindLabel) as SyncKind[]).map(kind => (
            <label key={kind} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={status.toggles[kind === 'exam' ? 'exams' : kind === 'assignment' ? 'assignments' : kind]}
                onChange={event => {
                  const toggles = { ...status.toggles };
                  if (kind === 'exam') toggles.exams = event.target.checked;
                  else if (kind === 'assignment') toggles.assignments = event.target.checked;
                  else toggles[kind] = event.target.checked;
                  void saveSettings(toggles, status.freeBusyOptIn);
                }}
              />
              {kindLabel[kind]}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={status.freeBusyOptIn} onChange={event => void pull(event.target.checked)} />
            {GOOGLE_CALENDAR_COPY.freeBusy}
          </label>
          <p className={`text-xs ${onInk}`}>{GOOGLE_CALENDAR_COPY.freeBusyNote}</p>
          <label className="block text-sm font-semibold">{GOOGLE_CALENDAR_COPY.absenceKeyword}
            <input className="mt-1 h-10 w-full rounded-xl border border-[#1E6A83]/30 px-3 text-sm" value={keyword} aria-label={GOOGLE_CALENDAR_COPY.absenceKeyword} onChange={event => setKeyword(event.target.value)} onBlur={() => void saveSettings(status.toggles, status.freeBusyOptIn)} />
          </label>
          <label className="block text-sm font-semibold">{GOOGLE_CALENDAR_COPY.absenceCalendar}
            <input className="mt-1 h-10 w-full rounded-xl border border-[#1E6A83]/30 px-3 text-sm" value={absenceCalendarId} aria-label={GOOGLE_CALENDAR_COPY.absenceCalendar} onChange={event => setAbsenceCalendarId(event.target.value)} onBlur={() => void saveSettings(status.toggles, status.freeBusyOptIn)} />
          </label>
          <p className={`text-xs ${onInk}`}>{GOOGLE_CALENDAR_COPY.absenceNote}</p>
          <p data-absences={absences.length} data-applied="0">{absences.length > 0 ? GOOGLE_CALENDAR_COPY.absenceQueued : null}</p>
          <button type="button" className={outline} data-action="google-disconnect" onClick={() => void post('disconnect', {}).then(() => { setMessage(GOOGLE_CALENDAR_COPY.disconnected); load(); })}>{GOOGLE_CALENDAR_COPY.disconnect}</button>
        </div>
      ) : null}
      <p className="text-sm">{GOOGLE_CALENDAR_COPY.lastSync}: {status.lastSyncAt ?? GOOGLE_CALENDAR_COPY.neverSynced}</p>
      <p className="text-sm" data-google-error="1">{GOOGLE_CALENDAR_COPY.lastError}: {status.lastError ?? GOOGLE_CALENDAR_COPY.noError}</p>
      {message ? <p className={`text-sm ${onInk}`} data-google-message="1">{message}</p> : null}
      <div>
        <h3 className="font-semibold">{GOOGLE_CALENDAR_COPY.feedTitle}</h3>
        <p className={`text-sm ${onInk}`} data-feed-note="1">{GOOGLE_CALENDAR_COPY.feedNote}</p>
        {status.feedUrl ? <p className="mt-1 break-all text-xs" data-feed-url="1">{status.feedUrl}</p> : null}
        <button type="button" className={`mt-2 ${outline}`} data-action="google-regenerate" onClick={() => void post('feed', { ics, regenerate: true }).then(({ response, data }) => {
          if (response.status === 401) setMessage(GOOGLE_CALENDAR_COPY.signIn);
          else if (data.url) setStatus(current => ({ ...current, feedUrl: data.url ?? null }));
        })}>{GOOGLE_CALENDAR_COPY.regenerate}</button>
      </div>
      {manageWorkspace && status.connected ? (
        <div className="space-y-2">
          <h3 className="font-semibold">{GOOGLE_CALENDAR_COPY.workspaceTitle}</h3>
          <label className="block text-sm font-semibold">{GOOGLE_CALENDAR_COPY.roomCalendar}
            <input className="mt-1 h-10 w-full rounded-xl border border-[#1E6A83]/30 px-3 text-sm" value={roomCalendarId} aria-label={GOOGLE_CALENDAR_COPY.roomCalendar} onChange={event => setRoomCalendarId(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">{GOOGLE_CALENDAR_COPY.eventsCalendar}
            <input className="mt-1 h-10 w-full rounded-xl border border-[#1E6A83]/30 px-3 text-sm" value={eventsCalendarId} aria-label={GOOGLE_CALENDAR_COPY.eventsCalendar} onChange={event => setEventsCalendarId(event.target.value)} />
          </label>
          <button type="button" className={outline} data-action="google-workspace" onClick={() => void post('workspace', {
            institutionId,
            roomCalendarId,
            eventsCalendarId,
            periods,
            rooms,
          }).then(({ data }) => {
            if (data.imported) {
              onWorkspace?.(data.imported);
              setMessage(GOOGLE_CALENDAR_COPY.imported);
            }
          })}>{GOOGLE_CALENDAR_COPY.importWorkspace}</button>
        </div>
      ) : null}
    </section>
  );
}
