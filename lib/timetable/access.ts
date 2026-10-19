import { TIMETABLE_COPY } from './copy';

export const TIMETABLER_ADDON_ID = 'et_ai_timetabler';
export const TIMETABLER_PERMISSION = 'addon:et_ai_timetabler';
export const TIMETABLER_PRICE_NOTE = TIMETABLE_COPY.priceNote;

export type TimetableEdition = 'locked' | 'view' | 'personal' | 'school' | 'enterprise';

export interface TimetableActor {
  uid?: string | null;
  role?: string | null;
  roles?: readonly string[] | null;
  permissions?: readonly string[] | null;
  plan?: string | null;
  package?: string | null;
  institutionId?: string | null;
  childIds?: readonly string[] | null;
}

function permissionsOf(actor: TimetableActor): string[] {
  return [...(actor.permissions ?? [])];
}

export function hasTimetablerAddon(actor: TimetableActor): boolean {
  if (actor.role === 'admin') return true;
  const permissions = permissionsOf(actor);
  return permissions.includes(TIMETABLER_PERMISSION) || permissions.includes('timetable:edit');
}

function packageName(actor: TimetableActor): string {
  return String(actor.package || actor.plan || '').trim().toLowerCase();
}

function isEnterprise(actor: TimetableActor): boolean {
  const pack = packageName(actor);
  if (pack === 'enterprise' || pack === 'oem') return true;
  return permissionsOf(actor).includes('package:enterprise');
}

/**
 * Teacher add-on: personal timetable.
 * Institution add-on: one-campus school timetable.
 * Enterprise add-on: more than one campus.
 * Students and parents can read a published week without the add-on.
 */
export function timetableEdition(actor: TimetableActor): TimetableEdition {
  const role = actor.role ?? '';
  const roles = new Set([role, ...(actor.roles ?? [])]);
  if (role === 'admin' || hasTimetablerAddon(actor)) {
    if (role === 'admin' || role === 'institution_admin' || roles.has('institution_admin')) {
      return isEnterprise(actor) || role === 'admin' ? 'enterprise' : 'school';
    }
    if (role === 'teacher' || roles.has('teacher')) return 'personal';
    if (role === 'institution_admin') return isEnterprise(actor) ? 'enterprise' : 'school';
  }
  if (role === 'student' || role === 'parent' || role === 'teacher' || roles.has('teacher') || roles.has('student') || roles.has('parent')) {
    return 'view';
  }
  return 'locked';
}

export function canEditSchool(actor: TimetableActor): boolean {
  const edition = timetableEdition(actor);
  if (actor.role === 'admin') return true;
  if (edition !== 'school' && edition !== 'enterprise') return false;
  return actor.role === 'institution_admin' || permissionsOf(actor).includes('timetable:edit') || hasTimetablerAddon(actor);
}

export function canEditPersonal(actor: TimetableActor): boolean {
  if (actor.role === 'admin') return true;
  return timetableEdition(actor) === 'personal' || (actor.role === 'teacher' && hasTimetablerAddon(actor));
}

export function canUseMultipleCampuses(actor: TimetableActor): boolean {
  return timetableEdition(actor) === 'enterprise' || actor.role === 'admin';
}
