import { can, resolveStaffRole } from './admin-console';
import {
  hasAccountRole,
  homeForMode,
  landingPath,
  type AccountMode,
} from './account-modes';
import { hasCmsAddon } from './entitlements';
import { isInstitutionAdmin, isSuperAdmin } from './roles';
import { stripAcademyPath } from './tenant-host';

export const ACCESS_DENIED_PARAM = 'notice';
export const ACCESS_DENIED_VALUE = '403';
export const ACCESS_DENIED_MESSAGE = 'You don’t have access to that page.';

export interface DashboardActor {
  role?: string | null;
  roles?: readonly string[] | null;
  email?: string | null;
  adminRole?: string | null;
  institutionId?: string | null;
  permissions?: string[] | null;
  accessTier?: number | null;
  subscriptionTier?: string | null;
  /** Set by the signed session when the server already checked the CMS add-on. */
  cms?: boolean | null;
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string; status: 403 };

const AUDIT_PREFIXES = ['/dashboard/admin/activity', '/dashboard/admin/audit'];
const PLATFORM_ADMIN_PREFIXES = [
  '/dashboard/admin/payments',
  '/dashboard/admin/integrations',
  '/dashboard/admin/finance',
];

export function normaliseDashboardPath(pathname: string): string {
  const bare = stripAcademyPath((pathname.split('?')[0] ?? '/').split('#')[0] ?? '/');
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1);
  return bare || '/';
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Role-restricted shells. Shared pages (profile, messages, studio) are not in this list. */
export function isRoleRestricted(pathname: string): boolean {
  const path = normaliseDashboardPath(pathname);
  return (
    matches(path, '/dashboard/admin')
    || matches(path, '/dashboard/teacher')
    || matches(path, '/dashboard/parent')
    || matches(path, '/dashboard/student')
    || matches(path, '/dashboard/institution')
  );
}

export function accessDeniedPath(actor: DashboardActor, mode: AccountMode | null = null): string {
  const home = mode ? homeForMode(mode) : landingPath(actor, null);
  return `${home}?${ACCESS_DENIED_PARAM}=${ACCESS_DENIED_VALUE}`;
}

function deny(actor: DashboardActor, mode: AccountMode | null): AccessDecision {
  return { allowed: false, redirectTo: accessDeniedPath(actor, mode), status: 403 };
}

function canOpenCms(actor: DashboardActor): boolean {
  if (actor.cms === true) return true;
  if (isSuperAdmin(actor)) return true;
  return hasCmsAddon(actor);
}

function canAudit(actor: DashboardActor): boolean {
  return can(resolveStaffRole({
    email: actor.email,
    role: actor.role,
    adminRole: actor.adminRole,
  }), 'audit');
}

/**
 * Page guard for dashboard shells.
 * Platform admin is `role === 'admin'` (or a bootstrap super-admin email).
 * Activity and the audit log additionally require the super-admin staff capability.
 * Curriculum stays open to a teacher or institution admin who has the CMS add-on.
 */
export function decideDashboardAccess(
  pathname: string,
  actor: DashboardActor,
  mode: AccountMode | null = null,
): AccessDecision {
  const path = normaliseDashboardPath(pathname);
  if (!isRoleRestricted(path)) return { allowed: true };

  if (AUDIT_PREFIXES.some(prefix => matches(path, prefix))) {
    return canAudit(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (PLATFORM_ADMIN_PREFIXES.some(prefix => matches(path, prefix))) {
    return isSuperAdmin(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/admin/institutions')) {
    return isSuperAdmin(actor) || isInstitutionAdmin(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/admin/curriculum')) {
    const staffCms = (hasAccountRole(actor, 'teacher') || isInstitutionAdmin(actor)) && canOpenCms(actor);
    return isSuperAdmin(actor) || staffCms ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/admin')) {
    return isSuperAdmin(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/institution')) {
    return isSuperAdmin(actor) || isInstitutionAdmin(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/teacher')) {
    const teaching = hasAccountRole(actor, 'teacher') || isSuperAdmin(actor) || isInstitutionAdmin(actor);
    return teaching ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/parent')) {
    return hasAccountRole(actor, 'parent') || isSuperAdmin(actor) ? { allowed: true } : deny(actor, mode);
  }
  if (matches(path, '/dashboard/student')) {
    const learner = hasAccountRole(actor, 'student')
      || hasAccountRole(actor, 'teacher')
      || hasAccountRole(actor, 'parent')
      || isSuperAdmin(actor);
    return learner ? { allowed: true } : deny(actor, mode);
  }
  return { allowed: true };
}

/** Next hop after the session page. Only in-app dashboard paths are accepted. */
export function safeDashboardNext(value: string | null | undefined, fallback = '/dashboard/student'): string {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith('/dashboard/') || next.startsWith('//') || next.includes('\\') || next.includes('://')) {
    return fallback;
  }
  const path = next.split('?')[0] ?? '';
  if (!path.startsWith('/dashboard/') || path.includes('//')) return fallback;
  return next;
}
