/**
 * Admin Action Centre tasks. Collection name is `admin_tasks`.
 * Clients never create these documents. The server opens one when a source
 * document is created, and resolves it when that source is resolved.
 * SafeLine identities are not stored on the task. `summary` is always safe.
 */
import { hideSafeguardingIdentity } from '@/lib/admin/desk';

/** Same clocks as DESK_SLA_MS. Kept here so a client import does not pull in node:crypto. */
export const ADMIN_SLA_MS = {
  critical: 15 * 60 * 1000,
  high: 60 * 60 * 1000,
  medium: 24 * 60 * 60 * 1000,
  low: 72 * 60 * 60 * 1000,
} as const;

export const ADMIN_TASKS = 'admin_tasks';
export const ADMIN_TASK_PREFS = 'notificationPrefs';
export const ADMIN_TASK_PREFS_DOC = 'admin';

export const ADMIN_TASK_TYPES = [
  'registration',
  'safeline_case',
  'teacher_verification',
  'institution_verification',
  'report',
  'partner_application',
  'amber_request',
  'course_review',
  'other',
] as const;

export const ADMIN_TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const ADMIN_TASK_STATUSES = ['open', 'claimed', 'snoozed', 'done', 'dismissed'] as const;
export const RESOLUTION_ACTIONS = ['done', 'dismiss', 'reject'] as const;

export type AdminTaskType = (typeof ADMIN_TASK_TYPES)[number];
export type AdminTaskPriority = (typeof ADMIN_TASK_PRIORITIES)[number];
export type AdminTaskStatus = (typeof ADMIN_TASK_STATUSES)[number];
export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number];

export interface AdminTaskScope {
  institutionId?: string;
  region?: string;
}

export interface AdminTaskResolution {
  action: ResolutionAction;
  reason: string;
  by: string;
  at: number;
}

/** Stored document. `refPath` is kept equal to `entityPath`. */
export interface AdminTask {
  id: string;
  type: AdminTaskType;
  entityType: string;
  entityPath: string;
  refPath: string;
  title: string;
  summary: string;
  priority: AdminTaskPriority;
  slaTier: AdminTaskPriority;
  scope: AdminTaskScope;
  status: AdminTaskStatus;
  claimedBy: string;
  claimedAt: number | null;
  createdAt: number;
  dueAt: number;
  snoozedUntil: number | null;
  resolvedAt: number | null;
  resolvedBy: string;
  resolutionReason: string;
  resolution: AdminTaskResolution | null;
}

export interface AdminPushPrefs {
  mode: 'instant' | 'digest';
  digestTimes: string[];
  quietHours: { start: string; end: string; tz: string };
  categories: { admin: boolean; emergency: boolean };
  lastDigestAt?: number;
}

export interface AdminTaskPushPayload {
  taskId: string;
  type: AdminTaskType;
  priority: AdminTaskPriority;
  slaTier: AdminTaskPriority;
  entityPath: string;
  deepLink: string;
  title: string;
}

const SENSITIVE_TYPES = new Set<AdminTaskType>(['safeline_case', 'amber_request']);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const NAMED = /\b(name|student|parent|reporter|caller)\s*:\s*[^,.\n]+/gi;

export function isAdminTaskType(value: string): value is AdminTaskType {
  return (ADMIN_TASK_TYPES as readonly string[]).includes(value);
}

export function isAdminTaskPriority(value: string): value is AdminTaskPriority {
  return (ADMIN_TASK_PRIORITIES as readonly string[]).includes(value);
}

export function isResolutionAction(value: string): value is ResolutionAction {
  return (RESOLUTION_ACTIONS as readonly string[]).includes(value);
}

/** Same clocks as the SafeLine desk: critical 15m, high 1h, medium 24h, low 72h. */
export function slaMs(tier: AdminTaskPriority): number {
  return ADMIN_SLA_MS[tier];
}

export function dueAtFor(createdAt: number, tier: AdminTaskPriority): number {
  return createdAt + slaMs(tier);
}

export function taskIdFor(entityPath: string): string {
  let hash = 0;
  for (const char of entityPath) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const slug = entityPath.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(-48);
  return `${slug}-${hash.toString(16)}`.slice(0, 80);
}

export function deepLinkFor(taskId: string): string {
  return `/dashboard/admin/tasks?task=${encodeURIComponent(taskId)}`;
}

/** Web route for the source. `entityPath` stays the Firestore path the app uses. */
export function sourceHref(task: Pick<AdminTask, 'type' | 'id'>): string {
  if (task.type === 'safeline_case') return '/dashboard/admin/hotline';
  if (task.type === 'amber_request') return '/dashboard/admin/emergency';
  if (task.type === 'institution_verification') return '/dashboard/admin/institutions';
  if (task.type === 'report') return '/dashboard/admin/moderation';
  if (task.type === 'course_review') return '/dashboard/admin/courses';
  if (task.type === 'registration' || task.type === 'teacher_verification') return '/dashboard/admin/users';
  if (task.type === 'partner_application') return '/dashboard/admin/partners';
  return deepLinkFor(task.id);
}

/** Strip addresses, phone numbers, and labelled names. The stored summary never keeps them. */
export function safeSummary(value: string): string {
  return value
    .replace(EMAIL, '[hidden]')
    .replace(PHONE, '[hidden]')
    .replace(NAMED, (_match, label: string) => `${label}: [hidden]`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

export function sensitiveTask(type: AdminTaskType): boolean {
  return SENSITIVE_TYPES.has(type);
}

export function storedTitle(type: AdminTaskType, title: string): string {
  if (type === 'safeline_case') return 'SafeLine case';
  if (type === 'amber_request') return 'Amber request';
  const clean = safeSummary(title);
  return (clean || 'Admin task').slice(0, 140);
}

export function reasonRequired(action: ResolutionAction): boolean {
  return action === 'dismiss' || action === 'reject';
}

export function resolutionProblem(action: ResolutionAction, reason: string): string {
  if (reasonRequired(action) && reason.trim().length < 3) {
    return 'A reason is required to reject or dismiss.';
  }
  if (reason.trim().length > 500) return 'Keep the reason under 500 characters.';
  return '';
}

/** `resolution` is the source of truth. The flat fields mirror it for older readers. */
export function withResolution(task: AdminTask, resolution: AdminTaskResolution | null, status: AdminTaskStatus): AdminTask {
  return {
    ...task,
    status,
    resolution,
    resolvedAt: resolution?.at ?? null,
    resolvedBy: resolution?.by ?? '',
    resolutionReason: resolution?.reason ?? '',
  };
}

export function presentTask(
  task: AdminTask,
  viewer: { staffRole?: string | null; staffPost?: string | null },
): AdminTask {
  if (!sensitiveTask(task.type) || !hideSafeguardingIdentity(viewer)) return task;
  return {
    ...task,
    title: task.type === 'amber_request' ? 'Amber request' : 'SafeLine case',
    summary: safeSummary(task.summary),
  };
}

const SLA_RANK: Record<AdminTaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortTasks(tasks: readonly AdminTask[], now: number): AdminTask[] {
  return [...tasks].sort((a, b) => {
    const aOver = a.dueAt < now ? 0 : 1;
    const bOver = b.dueAt < now ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (SLA_RANK[a.slaTier] !== SLA_RANK[b.slaTier]) return SLA_RANK[a.slaTier] - SLA_RANK[b.slaTier];
    return a.dueAt - b.dueAt;
  });
}

export function countdown(dueAt: number, now: number): { label: string; overdue: boolean } {
  const delta = dueAt - now;
  if (delta <= 0) {
    const late = Math.ceil(-delta / 60000);
    return { label: late < 60 ? `${late}m over` : `${Math.floor(late / 60)}h over`, overdue: true };
  }
  const mins = Math.ceil(delta / 60000);
  if (mins < 60) return { label: `${mins}m`, overdue: false };
  const hours = Math.ceil(mins / 60);
  if (hours < 48) return { label: `${hours}h`, overdue: false };
  return { label: `${Math.ceil(hours / 24)}d`, overdue: false };
}

export const DEFAULT_ADMIN_PUSH_PREFS: AdminPushPrefs = {
  mode: 'instant',
  digestTimes: ['08:00', '17:00'],
  quietHours: { start: '22:00', end: '07:00', tz: 'Asia/Kuala_Lumpur' },
  categories: { admin: true, emergency: true },
};

/** Urgent (high) and critical SafeLine use the emergency channel. Everything else uses admin. */
export function androidChannel(task: Pick<AdminTask, 'type' | 'slaTier' | 'priority'>): 'emergency' | 'admin' {
  if (task.type !== 'safeline_case') return 'admin';
  const urgent = task.slaTier === 'critical' || task.slaTier === 'high' || task.priority === 'critical' || task.priority === 'high';
  return urgent ? 'emergency' : 'admin';
}

export function pushPayload(task: AdminTask): AdminTaskPushPayload {
  return {
    taskId: task.id,
    type: task.type,
    priority: task.priority,
    slaTier: task.slaTier,
    entityPath: task.entityPath,
    deepLink: deepLinkFor(task.id),
    title: storedTitle(task.type, task.title),
  };
}

export function pushData(task: AdminTask): Record<string, string> {
  const payload = pushPayload(task);
  return {
    taskId: payload.taskId,
    type: payload.type,
    priority: payload.priority,
    slaTier: payload.slaTier,
    entityPath: payload.entityPath,
    deepLink: payload.deepLink,
    title: payload.title,
  };
}

function minutesOf(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesInZone(now: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Asia/Kuala_Lumpur',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(now));
    const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find(part => part.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    const date = new Date(now);
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

export function inQuietHours(prefs: AdminPushPrefs, now: number): boolean {
  const start = minutesOf(prefs.quietHours.start);
  const end = minutesOf(prefs.quietHours.end);
  if (start == null || end == null || start === end) return false;
  const nowMinutes = minutesInZone(now, prefs.quietHours.tz);
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

export type PushDecision = 'send' | 'digest' | 'quiet' | 'muted';

/** Emergency is never held for quiet hours or a muted admin category. */
export function pushDecision(prefs: AdminPushPrefs, channel: 'emergency' | 'admin', now: number): PushDecision {
  if (channel === 'emergency') return 'send';
  if (prefs.categories.admin === false) return 'muted';
  if (inQuietHours(prefs, now)) return 'quiet';
  if (prefs.mode === 'digest') return 'digest';
  return 'send';
}

export function digestDue(prefs: AdminPushPrefs, now: number, windowMs = 15 * 60 * 1000): boolean {
  if (prefs.mode !== 'digest') return false;
  if (prefs.lastDigestAt && now - prefs.lastDigestAt < windowMs) return false;
  const nowMinutes = minutesInZone(now, prefs.quietHours.tz);
  return prefs.digestTimes.some(clock => {
    const target = minutesOf(clock);
    if (target == null) return false;
    const delta = (nowMinutes - target + 1440) % 1440;
    return delta < windowMs / 60000;
  });
}

export function readAdminPushPrefs(raw: unknown): AdminPushPrefs {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const quiet = data.quietHours && typeof data.quietHours === 'object' ? data.quietHours as Record<string, unknown> : {};
  const categories = data.categories && typeof data.categories === 'object' ? data.categories as Record<string, unknown> : {};
  const times = Array.isArray(data.digestTimes)
    ? data.digestTimes.filter((item): item is string => typeof item === 'string' && minutesOf(item) != null).slice(0, 8)
    : DEFAULT_ADMIN_PUSH_PREFS.digestTimes;
  return {
    mode: data.mode === 'digest' ? 'digest' : 'instant',
    digestTimes: times.length ? times : DEFAULT_ADMIN_PUSH_PREFS.digestTimes,
    quietHours: {
      start: typeof quiet.start === 'string' && minutesOf(quiet.start) != null ? quiet.start : DEFAULT_ADMIN_PUSH_PREFS.quietHours.start,
      end: typeof quiet.end === 'string' && minutesOf(quiet.end) != null ? quiet.end : DEFAULT_ADMIN_PUSH_PREFS.quietHours.end,
      tz: typeof quiet.tz === 'string' && quiet.tz.trim() ? quiet.tz.trim().slice(0, 64) : DEFAULT_ADMIN_PUSH_PREFS.quietHours.tz,
    },
    categories: {
      admin: categories.admin !== false,
      emergency: true,
    },
    lastDigestAt: typeof data.lastDigestAt === 'number' ? data.lastDigestAt : undefined,
  };
}

export function adminInTaskScope(
  admin: { role?: string | null; adminRole?: string | null; institutionId?: string | null; region?: string | null },
  scope: AdminTaskScope,
): boolean {
  if (admin.adminRole === 'super_admin' || admin.role === 'super_admin') return true;
  if (admin.role !== 'admin' && admin.adminRole !== 'admin') return false;
  if (!scope.institutionId && !scope.region) return admin.adminRole === 'super_admin';
  if (scope.institutionId && admin.institutionId && admin.institutionId === scope.institutionId) return true;
  if (scope.region && admin.region && admin.region.toLowerCase() === scope.region.toLowerCase()) return true;
  return false;
}

function parseResolution(raw: unknown): AdminTaskResolution | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.action !== 'string' || !isResolutionAction(data.action)) return null;
  if (typeof data.by !== 'string' || typeof data.at !== 'number') return null;
  return { action: data.action, reason: typeof data.reason === 'string' ? data.reason : '', by: data.by, at: data.at };
}

export function parseAdminTask(id: string, raw: unknown): AdminTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.type !== 'string' || !isAdminTaskType(data.type)) return null;
  const priority = typeof data.priority === 'string' && isAdminTaskPriority(data.priority) ? data.priority : 'medium';
  const slaTier = typeof data.slaTier === 'string' && isAdminTaskPriority(data.slaTier) ? data.slaTier : priority;
  const entityPath = typeof data.entityPath === 'string' && data.entityPath.trim()
    ? data.entityPath
    : (typeof data.refPath === 'string' ? data.refPath : '');
  if (!entityPath) return null;
  const status = typeof data.status === 'string' && (ADMIN_TASK_STATUSES as readonly string[]).includes(data.status)
    ? data.status as AdminTaskStatus
    : 'open';
  const resolution = parseResolution(data.resolution);
  const scopeRaw = data.scope && typeof data.scope === 'object' ? data.scope as Record<string, unknown> : {};
  const scope: AdminTaskScope = {};
  if (typeof scopeRaw.institutionId === 'string' && scopeRaw.institutionId.trim()) scope.institutionId = scopeRaw.institutionId;
  if (typeof scopeRaw.region === 'string' && scopeRaw.region.trim()) scope.region = scopeRaw.region;
  const createdAt = typeof data.createdAt === 'number' ? data.createdAt : 0;
  return {
    id: id || (typeof data.id === 'string' ? data.id : taskIdFor(entityPath)),
    type: data.type,
    entityType: typeof data.entityType === 'string' && data.entityType.trim() ? data.entityType : data.type,
    entityPath,
    refPath: entityPath,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : storedTitle(data.type, ''),
    summary: typeof data.summary === 'string' ? data.summary : '',
    priority,
    slaTier,
    scope,
    status,
    claimedBy: typeof data.claimedBy === 'string' ? data.claimedBy : '',
    claimedAt: typeof data.claimedAt === 'number' ? data.claimedAt : null,
    createdAt,
    dueAt: typeof data.dueAt === 'number' ? data.dueAt : dueAtFor(createdAt, slaTier),
    snoozedUntil: typeof data.snoozedUntil === 'number' ? data.snoozedUntil : null,
    resolvedAt: resolution?.at ?? (typeof data.resolvedAt === 'number' ? data.resolvedAt : null),
    resolvedBy: resolution?.by ?? (typeof data.resolvedBy === 'string' ? data.resolvedBy : ''),
    resolutionReason: resolution?.reason ?? (typeof data.resolutionReason === 'string' ? data.resolutionReason : ''),
    resolution,
  };
}

export function adminPushPrefsPath(uid: string): string {
  return `users/${uid}/${ADMIN_TASK_PREFS}/${ADMIN_TASK_PREFS_DOC}`;
}

export function buildAdminTask(input: {
  type: AdminTaskType;
  entityType: string;
  entityPath: string;
  title: string;
  summary: string;
  priority: AdminTaskPriority;
  slaTier?: AdminTaskPriority;
  scope?: AdminTaskScope;
  now: number;
}): AdminTask {
  const entityPath = input.entityPath.trim().slice(0, 300);
  const slaTier = input.slaTier ?? input.priority;
  const scope: AdminTaskScope = {};
  if (input.scope?.institutionId?.trim()) scope.institutionId = input.scope.institutionId.trim().slice(0, 80);
  if (input.scope?.region?.trim()) scope.region = input.scope.region.trim().slice(0, 80);
  return {
    id: taskIdFor(entityPath),
    type: input.type,
    entityType: input.entityType.trim().slice(0, 80),
    entityPath,
    refPath: entityPath,
    title: storedTitle(input.type, input.title),
    summary: safeSummary(input.summary),
    priority: input.priority,
    slaTier,
    scope,
    status: 'open',
    claimedBy: '',
    claimedAt: null,
    createdAt: input.now,
    dueAt: dueAtFor(input.now, slaTier),
    snoozedUntil: null,
    resolvedAt: null,
    resolvedBy: '',
    resolutionReason: '',
    resolution: null,
  };
}
