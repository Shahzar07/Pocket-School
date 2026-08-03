/**
 * Roles and the permission questions the UI actually asks.
 *
 * There are two kinds of administrator:
 *
 *   admin               — super admin, platform-wide. Sees every institution.
 *   institution_admin   — scoped to a single institution via
 *                         UserProfile.institutionId. Runs their own school's
 *                         users, courses and reports and nothing else.
 *
 * Prefer these helpers over comparing `role` inline: a bare
 * `role === 'admin'` check silently locks institution admins out of screens
 * they are supposed to run.
 */

export type Role = 'student' | 'teacher' | 'parent' | 'admin' | 'institution_admin';

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  parent: 'Parent',
  admin: 'Super Admin',
  institution_admin: 'Institution Admin',
};

/**
 * Accounts that are super admins regardless of the role stored on their
 * profile. This is the bootstrap path — without it, losing the last admin
 * profile would lock the platform out of its own admin console.
 *
 * Compared case-insensitively.
 */
export const SUPER_ADMIN_EMAILS: readonly string[] = [
  'harry@poketschool.ai',
  'harry.seggu@gmail.com',
  'shahzarrayyan123@gmail.com',
];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

interface RoleContext {
  role?: string | null;
  email?: string | null;
  institutionId?: string | null;
}

/** Platform-wide administrator. */
export function isSuperAdmin(ctx: RoleContext | null | undefined): boolean {
  if (!ctx) return false;
  return ctx.role === 'admin' || isSuperAdminEmail(ctx.email);
}

/** Administrator of exactly one institution. */
export function isInstitutionAdmin(ctx: RoleContext | null | undefined): boolean {
  return ctx?.role === 'institution_admin';
}

/** Either kind of administrator — the usual "can see the admin console" test. */
export function isAdmin(ctx: RoleContext | null | undefined): boolean {
  return isSuperAdmin(ctx) || isInstitutionAdmin(ctx);
}

export function isTeacherOrAdmin(ctx: RoleContext | null | undefined): boolean {
  return ctx?.role === 'teacher' || isAdmin(ctx);
}

/**
 * Can this account act on the given institution? Super admins can act on any;
 * institution admins only on their own. An institution admin with no
 * institutionId assigned can act on none — failing closed is the safe default.
 */
export function canManageInstitution(
  ctx: RoleContext | null | undefined,
  institutionId: string | null | undefined,
): boolean {
  if (isSuperAdmin(ctx)) return true;
  if (!isInstitutionAdmin(ctx)) return false;
  return !!institutionId && ctx?.institutionId === institutionId;
}

/**
 * Institution to scope a listing to, or null meaning "no filter — show all".
 * Super admins get null; institution admins get their own id.
 */
export function institutionScope(ctx: RoleContext | null | undefined): string | null {
  if (isSuperAdmin(ctx)) return null;
  return ctx?.institutionId ?? null;
}

/** Where a role lands after signing in. */
export function homeForRole(ctx: RoleContext | null | undefined): string {
  if (isAdmin(ctx)) return '/dashboard/admin';
  if (ctx?.role === 'teacher') return '/dashboard/teacher';
  if (ctx?.role === 'parent') return '/dashboard/parent';
  return '/dashboard/student';
}
