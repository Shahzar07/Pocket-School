import { isStaffRole } from './admin-console';
import { isSuperAdminEmail } from './roles';

/**
 * Whether a verified Firebase identity may perform a platform-admin action.
 *
 * The role comes from the ID token's custom claims. A claim that names a
 * non-admin role is final — a request body cannot upgrade it. When the token
 * has no role claim yet, the server may use the Firestore profile of that
 * same uid. That profile is loaded after the token is verified; it is never
 * taken from the client.
 */
export function adminFromVerifiedIdentity(input: {
  email?: string | null;
  role?: string | null;
  adminRole?: string | null;
  profileRole?: string | null;
}): boolean {
  if (isSuperAdminEmail(input.email)) return true;
  if (input.role === 'admin') return true;
  if (input.adminRole && isStaffRole(input.adminRole)) return true;
  if (typeof input.role === 'string' && input.role.length > 0) return false;
  return input.profileRole === 'admin';
}

/**
 * Role a server check should use. An ID-token role or staff claim is final.
 * The Firestore profile is used only when the token has neither.
 */
export function roleForServerCheck(
  claims: { email?: string | null; role?: string | null; adminRole?: string | null },
  profileRole?: string | null,
): string {
  if (isSuperAdminEmail(claims.email)) return 'admin';
  if (claims.adminRole && isStaffRole(claims.adminRole)) return 'admin';
  if (typeof claims.role === 'string' && claims.role.length > 0) return claims.role;
  return typeof profileRole === 'string' ? profileRole : '';
}

/** Cookie fields. A parent claim is not replaced by an admin profile. */
export function sessionClaimsFromVerified(input: {
  tokenRole?: string | null;
  tokenAdminRole?: string | null;
  profileRole?: string | null;
  profileAdminRole?: string | null;
  profileRoles?: readonly string[] | null;
}): { role: string; adminRole: string; roles: string[] } {
  const tokenRole = typeof input.tokenRole === 'string' ? input.tokenRole : '';
  const tokenAdminRole = typeof input.tokenAdminRole === 'string' ? input.tokenAdminRole : '';
  const privileged = tokenRole === 'admin' || tokenRole === 'institution_admin';
  const role = tokenRole || (typeof input.profileRole === 'string' ? input.profileRole : '');
  const adminRole = tokenAdminRole
    || ((!tokenRole || privileged) && typeof input.profileAdminRole === 'string' ? input.profileAdminRole : '');
  const listed = (input.profileRoles ?? []).filter((item): item is string => typeof item === 'string');
  const roles = tokenRole && !privileged
    ? listed.filter(item => item !== 'admin' && item !== 'institution_admin')
    : listed;
  return { role, adminRole, roles };
}
