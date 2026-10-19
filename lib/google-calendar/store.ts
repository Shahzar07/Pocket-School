import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { feedSecret } from './config';
import { DEFAULT_TOGGLES, type SyncToggles } from './events';
import { verifyFeedToken } from './ical-link';

export interface CalendarConnection {
  uid: string;
  encryptedRefreshToken: string;
  calendarId: string;
  audience: string;
  scopes: string[];
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  toggles: SyncToggles;
  freeBusyOptIn: boolean;
  absenceCalendarId: string;
  absenceKeyword: string;
  pushedIds: string[];
}

export interface FeedRecord {
  uid: string;
  nonce: string;
  ics: string;
  updatedAt: string;
}

export interface WorkspaceConnection {
  institutionId: string;
  encryptedRefreshToken: string;
  roomCalendarId: string;
  eventsCalendarId: string;
  connectedBy: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

const CONNECTIONS = 'google_calendar_connections';
const FEEDS = 'google_calendar_feeds';
const WORKSPACE = 'google_workspace_calendars';

const memoryFeeds = new Map<string, FeedRecord>();

function togglesOf(value: unknown): SyncToggles {
  const row = value && typeof value === 'object' ? value as Partial<SyncToggles> : {};
  return {
    timetable: row.timetable !== false,
    cover: row.cover !== false,
    exams: row.exams !== false,
    assignments: row.assignments !== false,
    planner: row.planner !== false,
  };
}

function connectionFrom(uid: string, data: Record<string, unknown>): CalendarConnection {
  return {
    uid,
    encryptedRefreshToken: typeof data.encryptedRefreshToken === 'string' ? data.encryptedRefreshToken : '',
    calendarId: typeof data.calendarId === 'string' ? data.calendarId : '',
    audience: typeof data.audience === 'string' ? data.audience : 'teacher',
    scopes: Array.isArray(data.scopes) ? data.scopes.filter((item): item is string => typeof item === 'string') : [],
    connectedAt: typeof data.connectedAt === 'string' ? data.connectedAt : '',
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : null,
    lastError: typeof data.lastError === 'string' ? data.lastError : null,
    toggles: togglesOf(data.toggles),
    freeBusyOptIn: data.freeBusyOptIn === true,
    absenceCalendarId: typeof data.absenceCalendarId === 'string' ? data.absenceCalendarId : '',
    absenceKeyword: typeof data.absenceKeyword === 'string' ? data.absenceKeyword : 'leave',
    pushedIds: Array.isArray(data.pushedIds) ? data.pushedIds.filter((item): item is string => typeof item === 'string') : [],
  };
}

export async function loadConnection(uid: string): Promise<CalendarConnection | null> {
  if (!isAdminConfigured()) return null;
  const snap = await adminDb().collection(CONNECTIONS).doc(uid).get();
  if (!snap.exists) return null;
  return connectionFrom(uid, snap.data() ?? {});
}

export async function saveConnection(row: CalendarConnection): Promise<void> {
  if (!isAdminConfigured()) {
    throw new Error('Google Calendar needs the server account tools before a connection can be saved.');
  }
  await adminDb().collection(CONNECTIONS).doc(row.uid).set({
    ...row,
    toggles: row.toggles ?? DEFAULT_TOGGLES,
  });
}

export async function deleteConnection(uid: string): Promise<void> {
  if (!isAdminConfigured()) return;
  await adminDb().collection(CONNECTIONS).doc(uid).delete();
}

export async function loadFeed(uid: string): Promise<FeedRecord | null> {
  if (isAdminConfigured()) {
    const snap = await adminDb().collection(FEEDS).doc(uid).get();
    if (snap.exists) {
      const data = snap.data() ?? {};
      const row: FeedRecord = {
        uid,
        nonce: typeof data.nonce === 'string' ? data.nonce : '',
        ics: typeof data.ics === 'string' ? data.ics : '',
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      };
      memoryFeeds.set(uid, row);
      return row;
    }
  }
  return memoryFeeds.get(uid) ?? null;
}

export async function saveFeed(row: FeedRecord): Promise<void> {
  memoryFeeds.set(row.uid, row);
  if (!isAdminConfigured()) return;
  await adminDb().collection(FEEDS).doc(row.uid).set(row);
}

export async function readFeedByToken(token: string): Promise<FeedRecord | null> {
  const claims = verifyFeedToken(token, feedSecret());
  if (!claims) return null;
  const row = await loadFeed(claims.uid);
  if (!row || row.nonce !== claims.nonce || !row.ics) return null;
  return row;
}

export async function loadWorkspace(institutionId: string): Promise<WorkspaceConnection | null> {
  if (!isAdminConfigured() || !institutionId) return null;
  const snap = await adminDb().collection(WORKSPACE).doc(institutionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    institutionId,
    encryptedRefreshToken: typeof data.encryptedRefreshToken === 'string' ? data.encryptedRefreshToken : '',
    roomCalendarId: typeof data.roomCalendarId === 'string' ? data.roomCalendarId : '',
    eventsCalendarId: typeof data.eventsCalendarId === 'string' ? data.eventsCalendarId : '',
    connectedBy: typeof data.connectedBy === 'string' ? data.connectedBy : '',
    lastSyncAt: typeof data.lastSyncAt === 'string' ? data.lastSyncAt : null,
    lastError: typeof data.lastError === 'string' ? data.lastError : null,
  };
}

export async function saveWorkspace(row: WorkspaceConnection): Promise<void> {
  if (!isAdminConfigured()) {
    throw new Error('Google Calendar needs the server account tools before a school calendar can be saved.');
  }
  await adminDb().collection(WORKSPACE).doc(row.institutionId).set(row);
}

export async function userCanManageWorkspace(uid: string): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const snap = await adminDb().collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const role = snap.get('role');
  const permissions = snap.get('permissions');
  if (role === 'admin' || role === 'institution_admin') return true;
  return Array.isArray(permissions) && permissions.includes('timetable:edit');
}
