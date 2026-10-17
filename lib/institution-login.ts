/**
 * Branded sign-in for one institution.
 *
 * `/i/{slug}/login` is the page. On `{slug}.poketschool.ai` and on a custom
 * domain, `/login` is that same page. The apex `/login` and `/admin/login`
 * stay Poket School's own doors.
 */

import { heldRoles, landingPath, type AccountMode, type RoleSource } from './account-modes';
import { institutionAdminDestination } from './institution-journey';
import { normaliseCustomDomain } from './oem';
import { normaliseSubdomain, PLATFORM_ROOT, stripAcademyPath, tenantFromRequest } from './tenant-host';

/** Custom domains have no slug in the host. Middleware rewrites them here. */
export const HOST_LOGIN_SLUG = '_host';

export const PLATFORM_LOGIN_URL = 'https://poketschool.ai/login';

export const INSTITUTION_ADMIN_CODE_UNAVAILABLE =
  'Email codes are unavailable because mail is not configured on this server. Institution admin sign-in stops here. Ask Poket School to turn on email codes, then try again.';

export type InstitutionLoginTab = 'student' | 'teacher' | 'institution_admin';

export const INSTITUTION_LOGIN_TABS: readonly { id: InstitutionLoginTab; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'institution_admin', label: 'Institution admin' },
];

function barePath(pathname: string): string {
  const path = (pathname.split('?')[0]?.split('#')[0] ?? '').replace(/\/+$/, '');
  return path || '/';
}

/** True for the branded login, including the path fallback and the static preview. */
export function isBrandedLoginPath(pathname: string): boolean {
  const path = barePath(pathname);
  if (path === '/login' || path === '/preview/institution-login') return true;
  return /^\/i\/[a-z0-9_-]+\/login$/i.test(path) || /^\/a\/[a-z0-9-]+\/login$/i.test(path);
}

/**
 * Internal path for an academy `/login`. Null on the apex, so the main
 * Poket School login stays in place. `/admin/login` is never rewritten.
 */
export function institutionLoginRewrite(host: string | null | undefined, pathname: string): string | null {
  const tenant = tenantFromRequest(host, pathname);
  const path = barePath(tenant.kind === 'path' ? stripAcademyPath(pathname) : pathname);
  if (path !== '/login') return null;
  if (tenant.kind === 'subdomain' || tenant.kind === 'path') return `/i/${tenant.slug}/login`;
  if (tenant.kind === 'custom') return `/i/${HOST_LOGIN_SLUG}/login`;
  return null;
}

export interface InstitutionLoginLinks {
  /** Address to copy, encode as a QR, and put in invite mail. */
  share: string;
  /** Apex route that renders the same page when the slug is known. */
  direct: string;
}

/** Custom domain, then the academy subdomain, then the apex `/i/{slug}/login` path. */
export function institutionLoginLinks(input: {
  slug?: string | null;
  customDomain?: string | null;
  root?: string;
}): InstitutionLoginLinks {
  const rootHost = (input.root ?? PLATFORM_ROOT).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const slug = input.slug ? normaliseSubdomain(input.slug) : null;
  const direct = slug ? `https://${rootHost}/i/${slug}/login` : '';
  const custom = normaliseCustomDomain(input.customDomain ?? '');
  if (custom) return { share: `https://${custom}/login`, direct };
  if (slug) return { share: `https://${slug}.${rootHost}/login`, direct };
  return { share: direct, direct };
}

export function institutionLoginRefusal(schoolName: string): string {
  const name = schoolName.trim() || 'this academy';
  return `This page is for ${name} students, teachers, and institution admins. This account is not a member of ${name}.`;
}

export interface InstitutionLoginActor extends RoleSource {
  institutionId?: string | null;
  /** Institution ids confirmed by a member record when the profile field differs. */
  memberOf?: readonly string[] | null;
}

export type InstitutionLoginDecision =
  | { allowed: false; reason: 'not_member' }
  | { allowed: true; destination: string; needsEmailCode: boolean; mode: AccountMode | null };

export function belongsToInstitution(actor: InstitutionLoginActor | null | undefined, institutionId: string): boolean {
  if (!actor || !institutionId) return false;
  if (actor.institutionId && actor.institutionId === institutionId) return true;
  return (actor.memberOf ?? []).includes(institutionId);
}

/**
 * Members continue to their own dashboard. Institution admins of this academy
 * always confirm with an email code and land on the institution dashboard.
 * Platform staff who are not admins of this academy use /admin/login instead.
 */
export function decideInstitutionLogin(
  actor: InstitutionLoginActor | null | undefined,
  institutionId: string,
  options?: {
    storedMode?: string | null;
    tab?: InstitutionLoginTab;
    platformStaff?: boolean;
    /** When set, a pending academy or a first-time admin leaves the dashboard path. */
    institutionStatus?: string | null;
    setupComplete?: boolean | null;
    billingPhase?: string | null;
    reviewHold?: boolean | null;
  },
): InstitutionLoginDecision {
  if (!belongsToInstitution(actor, institutionId)) return { allowed: false, reason: 'not_member' };
  const held = heldRoles(actor);
  const schoolAdmin = held.includes('institution_admin');
  if ((options?.platformStaff || held.includes('admin')) && !schoolAdmin) {
    return { allowed: false, reason: 'not_member' };
  }
  if (schoolAdmin) {
    const destination = options?.institutionStatus
      ? institutionAdminDestination({
          status: options.institutionStatus,
          setupComplete: options.setupComplete,
          billingPhase: options.billingPhase,
          reviewHold: options.reviewHold,
        })
      : '/dashboard/institution';
    return { allowed: true, destination, needsEmailCode: true, mode: null };
  }
  const tab = options?.tab;
  if (tab === 'teacher' && held.includes('teacher')) {
    return { allowed: true, destination: '/dashboard/teacher', needsEmailCode: false, mode: 'teacher' };
  }
  if (tab === 'student' && (held.includes('student') || held.includes('teacher') || held.includes('parent'))) {
    return { allowed: true, destination: '/dashboard/student', needsEmailCode: false, mode: 'student' };
  }
  const destination = landingPath(actor, options?.storedMode ?? null);
  const mode = destination === '/dashboard/teacher'
    ? 'teacher'
    : destination === '/dashboard/parent'
      ? 'parent'
      : destination === '/dashboard/student'
        ? 'student'
        : null;
  return { allowed: true, destination, needsEmailCode: false, mode };
}
