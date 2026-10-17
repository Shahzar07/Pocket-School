/**
 * Activity log model. Documents are written by the server. Clients never
 * choose the actor, the time, or the IP.
 */

export const MIN_RETENTION_DAYS = 90;
export const MAX_RETENTION_DAYS = 3650;
export const DEFAULT_RETENTION_DAYS = 730;

export const ACTIVITY_ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.login_failed',
  'auth.two_factor_challenge',
  'auth.two_factor_success',
  'auth.two_factor_failed',
  'auth.two_factor_enabled',
  'auth.two_factor_disabled',
  'role.switch',
  'content.edit',
  'content.publish',
  'content.delete',
  'settings.edit',
  'pricing.edit',
  'flags.edit',
  'allocation.edit',
  'payments.edit',
  'admin.action',
  'impersonation.start',
  'impersonation.stop',
  'certificate.issue',
  'certificate.revoke',
  'certificate.bulk',
  'retention.set',
  'retention.purge',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityCategory =
  | 'auth'
  | 'role'
  | 'content'
  | 'settings'
  | 'admin'
  | 'impersonation'
  | 'certificate'
  | 'retention';

export interface DiffRow {
  path: string;
  before: unknown;
  after: unknown;
}

export interface ActivityEvent {
  category: ActivityCategory;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  at: number;
  ip: string;
  device: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  before: unknown;
  after: unknown;
  diff: DiffRow[];
  /** Set when the action belongs to one institution. Platform rows omit it. */
  institutionId?: string;
}

export interface ActivityDraft {
  action: string;
  actorId: string;
  actorEmail?: string;
  actorRole: string;
  ip?: string;
  device?: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
  at?: number;
  institutionId?: string;
}

const PUBLIC_ACTIONS = new Set<string>(['auth.login_failed', 'auth.two_factor_failed']);

const SIGNED_IN_ACTIONS = new Set<string>([
  'auth.login',
  'auth.logout',
  'auth.two_factor_challenge',
  'auth.two_factor_success',
  'auth.two_factor_failed',
  'auth.two_factor_enabled',
  'auth.two_factor_disabled',
  'role.switch',
]);

const CONTENT_ROLES = new Set(['teacher', 'admin', 'super_admin', 'institution_admin', 'content_editor']);
const SETTINGS_ROLES = new Set(['admin', 'super_admin']);
const ALLOCATION_ROLES = new Set(['teacher', 'admin', 'super_admin', 'institution_admin', 'content_editor']);
const VIEW_AS_ROLES = new Set(['admin', 'super_admin', 'support']);

const SECRET_KEY = /password|secret|api[-_]?key|private[-_]?key|idToken|refreshToken|serviceAccount/i;

export function isActivityAction(value: string): value is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

export function isPublicAuditAction(action: string): boolean {
  return PUBLIC_ACTIONS.has(action);
}

export function categoryFor(action: string): ActivityCategory {
  if (action.startsWith('auth.')) return 'auth';
  if (action.startsWith('role.')) return 'role';
  if (action.startsWith('content.')) return 'content';
  if (action.startsWith('impersonation.')) return 'impersonation';
  if (action.startsWith('certificate.')) return 'certificate';
  if (action.startsWith('retention.')) return 'retention';
  if (action.startsWith('progress.')) return 'admin';
  if (action === 'admin.action') return 'admin';
  return 'settings';
}

/** Whether this signed-in role may ask the server to record the action. */
export function clientMayReport(action: string, actorRole: string): boolean {
  if (!isActivityAction(action) || action === 'auth.login_failed') return false;
  if (SIGNED_IN_ACTIONS.has(action)) return actorRole.length > 0;
  if (action === 'content.edit' || action === 'content.publish' || action === 'content.delete') {
    return CONTENT_ROLES.has(actorRole);
  }
  if (action === 'allocation.edit') return ALLOCATION_ROLES.has(actorRole);
  if (action === 'impersonation.start' || action === 'impersonation.stop') return VIEW_AS_ROLES.has(actorRole);
  if (
    action === 'settings.edit'
    || action === 'pricing.edit'
    || action === 'flags.edit'
    || action === 'payments.edit'
    || action === 'admin.action'
  ) {
    return SETTINGS_ROLES.has(actorRole);
  }
  return false;
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'auth.login': 'Signed in',
    'auth.logout': 'Signed out',
    'auth.login_failed': 'Failed sign-in',
    'auth.two_factor_challenge': 'Two-factor code sent',
    'auth.two_factor_success': 'Two-factor accepted',
    'auth.two_factor_failed': 'Two-factor rejected',
    'auth.two_factor_enabled': 'Two-factor turned on',
    'auth.two_factor_disabled': 'Two-factor turned off',
    'role.switch': 'Role switch',
    'content.edit': 'Content edit',
    'content.publish': 'Publish',
    'content.delete': 'Delete',
    'settings.edit': 'Settings edit',
    'pricing.edit': 'Pricing edit',
    'flags.edit': 'Feature flag',
    'allocation.edit': 'Allocation edit',
    'payments.edit': 'Payments config',
    'admin.action': 'Admin action',
    'impersonation.start': 'View as started',
    'impersonation.stop': 'View as ended',
    'certificate.issue': 'Certificate issued',
    'certificate.revoke': 'Certificate revoked',
    'certificate.bulk': 'Bulk certificates',
    'retention.set': 'Retention updated',
    'retention.purge': 'Retention purge',
    'progress.acknowledge': 'Progress alert acknowledged',
    'progress.assign': 'Progress alert assigned',
    'progress.note': 'Progress alert note',
    'progress.resolve': 'Progress alert resolved',
    'progress.settings': 'Progress alert settings',
    'progress.act': 'Progress action logged',
    'progress.seen': 'Progress alert seen by family',
    'progress.parent_act': 'Family progress action',
    'progress.delegate': 'Progress alert delegated',
    'progress.check_in': 'Progress check-in',
    'progress.meeting': 'Progress meeting saved',
  };
  return labels[action] ?? action;
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).slice(0, 40)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitizeValue(source[key], depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function diffRecords(before: unknown, after: unknown): DiffRow[] {
  const rows: DiffRow[] = [];
  walk(before, after, '', rows);
  return rows;
}

function walk(before: unknown, after: unknown, path: string, rows: DiffRow[]) {
  if (rows.length >= 80) return;
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (isPlain(before) && isPlain(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      walk(before[key], after[key], path ? `${path}.${key}` : key, rows);
    }
    return;
  }
  rows.push({ path: path || '$', before: before ?? null, after: after ?? null });
}

export function activityDocument(input: ActivityDraft): ActivityEvent {
  const before = sanitizeValue(input.before);
  const after = sanitizeValue(input.after);
  return {
    category: categoryFor(input.action),
    action: input.action,
    actorId: input.actorId.slice(0, 128),
    actorEmail: (input.actorEmail ?? '').slice(0, 200),
    actorRole: input.actorRole.slice(0, 40),
    at: input.at ?? Date.now(),
    ip: (input.ip ?? '').slice(0, 64),
    device: (input.device ?? '').slice(0, 180),
    targetType: input.targetType.slice(0, 40),
    targetId: input.targetId.slice(0, 200),
    targetLabel: (input.targetLabel ?? '').slice(0, 200),
    before,
    after,
    diff: diffRecords(before, after),
    ...(input.institutionId?.trim() ? { institutionId: input.institutionId.trim().slice(0, 128) } : {}),
  };
}

export interface ActivityFilter {
  q?: string;
  category?: string;
  action?: string;
  actor?: string;
  target?: string;
  from?: number;
  to?: number;
}

export function filterActivity<T extends ActivityEvent>(rows: T[], filter: ActivityFilter): T[] {
  const q = filter.q?.trim().toLowerCase() ?? '';
  const actor = filter.actor?.trim().toLowerCase() ?? '';
  const target = filter.target?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (filter.category && filter.category !== 'all' && row.category !== filter.category) return false;
    if (filter.action && filter.action !== 'all' && row.action !== filter.action) return false;
    if (actor && !`${row.actorEmail} ${row.actorId} ${row.actorRole}`.toLowerCase().includes(actor)) return false;
    if (target && !`${row.targetType} ${row.targetId} ${row.targetLabel}`.toLowerCase().includes(target)) return false;
    if (typeof filter.from === 'number' && row.at < filter.from) return false;
    if (typeof filter.to === 'number' && row.at > filter.to) return false;
    if (!q) return true;
    const hay = `${row.actorEmail} ${row.actorId} ${row.action} ${row.category} ${row.targetType} ${row.targetId} ${row.targetLabel} ${row.ip} ${row.device} ${JSON.stringify(row.diff)}`.toLowerCase();
    return hay.includes(q);
  });
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function activityCsv(rows: ActivityEvent[]): string {
  const header = ['Time', 'Actor', 'Role', 'Action', 'Category', 'Target type', 'Target', 'Label', 'IP', 'Device', 'Diff'];
  const lines = rows.map((row) => [
    new Date(row.at).toISOString(),
    row.actorEmail || row.actorId,
    row.actorRole,
    row.action,
    row.category,
    row.targetType,
    row.targetId,
    row.targetLabel,
    row.ip,
    row.device,
    JSON.stringify(row.diff),
  ]);
  return [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
}

export function clampRetention(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.round(days)));
}

export function retentionCutoff(days: number, now: number): number {
  return now - clampRetention(days) * 24 * 60 * 60 * 1000;
}

export function requestClient(headers: { get(name: string): string | null }): { ip: string; device: string } {
  const forwarded = headers.get('x-forwarded-for') ?? '';
  const ip = (forwarded.split(',')[0] || headers.get('x-real-ip') || '').trim().slice(0, 64);
  const device = (headers.get('user-agent') ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return { ip, device };
}
