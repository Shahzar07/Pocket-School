import { isSuperAdminEmail } from '@/lib/roles';

/** Who may open /dashboard/results. Teachers stay on the teaching desk. */
export function resultsPageAllowed(actor: {
  role?: string | null;
  roles?: readonly string[] | null;
  email?: string | null;
}): boolean {
  if (actor.role === 'admin' || isSuperAdminEmail(actor.email)) return true;
  if (actor.role === 'institution_admin') return true;
  if (actor.role === 'parent' || (actor.roles ?? []).includes('parent')) return true;
  if (actor.role === 'teacher') return false;
  return actor.role === 'student' || (actor.roles ?? []).includes('student');
}
