/**
 * Admin console policy. The API and the directory both call these functions
 * so a role change, a suspension, and a Sparks grant follow one set of rules.
 */

export const FIRST_SUPER_ADMIN = {
  name: 'Harry Seggu',
  email: 'shahzarrayyan123@gmail.com',
} as const;

export const STAFF_ROLES = ['super_admin', 'admin', 'content_editor', 'support', 'finance'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ADMIN_SESSION_MS = 30 * 60 * 1000;

export const STAFF_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  content_editor: 'Content Editor',
  support: 'Support',
  finance: 'Finance',
};

const CAPABILITIES = {
  super_admin: ['manage_super', 'set_role', 'invite', 'moderate', 'sparks', 'tier', 'content', 'support', 'audit', 'view_as', 'sessions'],
  admin: ['set_role', 'invite', 'moderate', 'sparks', 'tier', 'content', 'support', 'view_as', 'sessions'],
  content_editor: ['content'],
  support: ['moderate', 'support', 'view_as', 'sessions'],
  finance: ['sparks', 'tier'],
} as const;

export type StaffCapability = (typeof CAPABILITIES)[StaffRole][number];

export type AccountState = 'active' | 'suspended' | 'pending' | 'inactive' | 'banned' | 'deleted';

const BLOCKED: AccountState[] = ['suspended', 'banned', 'deleted'];

export interface StaffProfile {
  id?: string;
  email?: string | null;
  role?: string | null;
  adminRole?: string | null;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  staffRole: StaffRole | null;
  tier: number | null;
  institutionId: string;
  status: string;
  country: string;
}

export interface AuditRecord {
  actorId: string;
  actorEmail: string;
  action: string;
  targetId: string;
  at: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export function isStaffRole(value: string | null | undefined): value is StaffRole {
  return !!value && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Owner emails stay super admins even before a custom claim is written. */
export function resolveStaffRole(profile: StaffProfile | null | undefined): StaffRole | null {
  if (!profile) return null;
  const email = profile.email?.trim().toLowerCase();
  if (email && email === FIRST_SUPER_ADMIN.email) return 'super_admin';
  if (isStaffRole(profile.adminRole)) return profile.adminRole;
  if (profile.role === 'admin') return 'admin';
  return null;
}

export function mfaRequired(staff: StaffRole | null): boolean {
  return staff === 'super_admin' || staff === 'admin';
}

export function loginBlocked(status: string | null | undefined): boolean {
  return BLOCKED.includes(status as AccountState);
}

/** Platform staff use the admin sign-in, including the owner email before a profile exists. */
export function requiresAdminLogin(profile: StaffProfile | null | undefined): boolean {
  return resolveStaffRole(profile) != null;
}

export function can(staff: StaffRole | null, capability: StaffCapability): boolean {
  if (!staff) return false;
  return (CAPABILITIES[staff] as readonly string[]).includes(capability);
}

export function platformRoleFor(staff: StaffRole | null, currentRole: string): string {
  if (!staff) return currentRole === 'admin' ? 'teacher' : currentRole;
  return 'admin';
}

export function customClaimsFor(staff: StaffRole | null, platformRole: string): Record<string, string> {
  return {
    ...(staff ? { adminRole: staff } : { adminRole: '' }),
    role: platformRole,
  };
}

export interface RoleChange {
  actorId: string;
  actor: StaffRole | null;
  targetId: string;
  target: StaffRole | null;
  next: StaffRole | null;
  superAdminIds: string[];
}

/** Super admins stay until another super admin can take the action. */
export function decideRoleChange(change: RoleChange): { ok: true } | { ok: false; error: string } {
  const managingSuper = change.target === 'super_admin' || change.next === 'super_admin';
  if (managingSuper && !can(change.actor, 'manage_super')) {
    return { ok: false, error: 'Only a super admin can change a super admin.' };
  }
  if (!managingSuper && !can(change.actor, 'set_role')) {
    return { ok: false, error: 'This role cannot change staff roles.' };
  }
  const leaving = change.target === 'super_admin' && change.next !== 'super_admin';
  if (!leaving) return { ok: true };
  const remaining = change.superAdminIds.filter(id => id !== change.targetId);
  if (remaining.length === 0) {
    return { ok: false, error: 'The last super admin stays in place.' };
  }
  if (change.actorId === change.targetId) {
    return { ok: false, error: 'Ask another super admin to change your role.' };
  }
  return { ok: true };
}

export function decideModeration(input: {
  actorId: string;
  actor: StaffRole | null;
  targetId: string;
  target: StaffRole | null;
  next: AccountState;
  superAdminIds: string[];
  reason: string;
}): { ok: true } | { ok: false; error: string } {
  if (!can(input.actor, 'moderate')) return { ok: false, error: 'This role cannot change account status.' };
  if (!input.reason.trim()) return { ok: false, error: 'A reason is required.' };
  if (input.target === 'super_admin' && !can(input.actor, 'manage_super')) {
    return { ok: false, error: 'Only a super admin can change a super admin.' };
  }
  const blocking = loginBlocked(input.next);
  if (input.target === 'super_admin' && blocking) {
    const remaining = input.superAdminIds.filter(id => id !== input.targetId);
    if (remaining.length === 0) return { ok: false, error: 'The last super admin stays in place.' };
    if (input.actorId === input.targetId) return { ok: false, error: 'You cannot block your own super admin account.' };
  }
  return { ok: true };
}

export function decideSparks(input: {
  actor: StaffRole | null;
  target: StaffRole | null;
  amount: number;
  reason: string;
  balance: number;
}): { ok: true } | { ok: false; error: string } {
  if (!can(input.actor, 'sparks')) return { ok: false, error: 'This role cannot adjust Sparks.' };
  if (input.target === 'super_admin' && !can(input.actor, 'manage_super')) {
    return { ok: false, error: 'Only a super admin can change a super admin.' };
  }
  if (!input.reason.trim()) return { ok: false, error: 'A reason is required.' };
  if (!Number.isFinite(input.amount) || input.amount === 0) return { ok: false, error: 'Enter a Sparks amount.' };
  if (input.balance + input.amount < 0) return { ok: false, error: 'That would take the balance below zero.' };
  return { ok: true };
}

export function filterDirectory(
  users: DirectoryUser[],
  filter: {
    query?: string;
    role?: string;
    staffRole?: string;
    tier?: string;
    institutionId?: string;
    status?: string;
    country?: string;
  },
): DirectoryUser[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  return users.filter(user => {
    if (filter.role && filter.role !== 'all' && user.role !== filter.role) return false;
    if (filter.staffRole && filter.staffRole !== 'all' && user.staffRole !== filter.staffRole) return false;
    if (filter.tier && filter.tier !== 'all' && String(user.tier ?? '') !== filter.tier) return false;
    if (filter.institutionId && filter.institutionId !== 'all' && user.institutionId !== filter.institutionId) return false;
    if (filter.status && filter.status !== 'all' && user.status !== filter.status) return false;
    if (filter.country && filter.country !== 'all' && user.country.toLowerCase() !== filter.country.toLowerCase()) return false;
    if (q && !`${user.name} ${user.email}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function directoryCsv(users: DirectoryUser[]): string {
  const header = ['Name', 'Email', 'Role', 'Staff role', 'Status', 'Tier', 'Institution', 'Country'];
  const lines = users.map(user => [
    user.name, user.email, user.role, user.staffRole ?? '', user.status,
    user.tier ?? '', user.institutionId, user.country,
  ]);
  return [header, ...lines].map(line => line.map(csvCell).join(',')).join('\n');
}

export function auditEntry(input: Omit<AuditRecord, 'at'> & { at?: number }): AuditRecord {
  return { ...input, at: input.at ?? Date.now() };
}

export function filterAudit(
  entries: AuditRecord[],
  filter: { actor?: string; action?: string; target?: string },
): AuditRecord[] {
  const actor = filter.actor?.trim().toLowerCase() ?? '';
  const action = filter.action?.trim().toLowerCase() ?? '';
  const target = filter.target?.trim().toLowerCase() ?? '';
  return entries.filter(entry => {
    if (actor && !`${entry.actorEmail} ${entry.actorId}`.toLowerCase().includes(actor)) return false;
    if (action && !entry.action.toLowerCase().includes(action)) return false;
    if (target && !entry.targetId.toLowerCase().includes(target)) return false;
    return true;
  });
}

export function sessionExpired(lastActiveAt: number, now: number, limit = ADMIN_SESSION_MS): boolean {
  return now - lastActiveAt >= limit;
}

export function platformKpis(input: {
  users: { createdAt: number; lastActiveAt: number; status: string }[];
  sparksIssued: number;
  sparksSpent: number;
  revenue: number;
  completions: number;
  openTickets: number;
  now: number;
}): {
  signups30: number;
  active7: number;
  sparksIssued: number;
  sparksSpent: number;
  revenue: number;
  completions: number;
  openTickets: number;
} {
  const month = input.now - 30 * 24 * 60 * 60 * 1000;
  const week = input.now - 7 * 24 * 60 * 60 * 1000;
  return {
    signups30: input.users.filter(user => user.createdAt >= month).length,
    active7: input.users.filter(user => user.lastActiveAt >= week && !loginBlocked(user.status)).length,
    sparksIssued: input.sparksIssued,
    sparksSpent: input.sparksSpent,
    revenue: input.revenue,
    completions: input.completions,
    openTickets: input.openTickets,
  };
}

export function systemHealth(input: { quotaErrors: number; generationFailures: number }): {
  firestore: 'ok' | 'attention';
  generation: 'ok' | 'attention';
} {
  return {
    firestore: input.quotaErrors > 0 ? 'attention' : 'ok',
    generation: input.generationFailures > 0 ? 'attention' : 'ok',
  };
}

export function superAdminIds(users: StaffProfile[]): string[] {
  return users.filter(user => resolveStaffRole(user) === 'super_admin' && user.id).map(user => user.id as string);
}
