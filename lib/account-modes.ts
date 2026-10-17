/**
 * One login can hold learner, teacher, and parent together.
 * `roles` is the list the server and Firestore rules trust.
 * The open dashboard is `poket-active-mode` in the browser. It is not a
 * permission. Admin and institution admin stay on their own shells and
 * still sign in through the admin page with a verification code.
 */

import type { Role } from './roles';

export const MODE_STORAGE_KEY = 'poket-active-mode';

export type AccountMode = 'student' | 'teacher' | 'parent';

export const MODE_LABELS: Record<AccountMode, string> = {
  student: 'Switch to Learning',
  teacher: 'Switch to Teaching',
  parent: 'Parent view',
};

export const MODE_NAMES: Record<AccountMode, string> = {
  student: 'Learning',
  teacher: 'Teaching',
  parent: 'Parent',
};

const MODE_ORDER: readonly AccountMode[] = ['student', 'teacher', 'parent'];
const KNOWN: readonly Role[] = ['student', 'teacher', 'parent', 'admin', 'institution_admin'];

export interface RoleSource {
  role?: string | null;
  roles?: readonly string[] | null;
}

export interface ShelfItem {
  id: string;
  ownerId?: string | null;
  studentId?: string | null;
  childId?: string | null;
}

export interface InstructorOnboarding {
  roles: Role[];
  instructor: { headline: string; bio: string; public: false };
}

function isKnown(value: string): value is Role {
  return (KNOWN as readonly string[]).includes(value);
}

export function isAccountMode(value: string): value is AccountMode {
  return value === 'student' || value === 'teacher' || value === 'parent';
}

function unique(values: readonly Role[]): Role[] {
  const seen = new Set<Role>();
  const next: Role[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

function orderedModes(values: readonly string[]): AccountMode[] {
  return MODE_ORDER.filter(mode => values.includes(mode));
}

/** Roles written on the profile. No learner space is implied here. */
export function heldRoles(source: RoleSource | null | undefined): Role[] {
  if (!source) return [];
  const listed = (source.roles ?? []).filter(isKnown);
  const primary = source.role && isKnown(source.role) ? [source.role] : [];
  return unique([...primary, ...listed]);
}

export function hasAccountRole(source: RoleSource | null | undefined, role: Role): boolean {
  return heldRoles(source).includes(role);
}

/**
 * Roles the switch can offer. A teacher or parent also has a learner space.
 * An admin or institution admin keeps that shell and is not given Learning.
 */
export function accountRoles(source: RoleSource | null | undefined): Role[] {
  const held = heldRoles(source);
  const privileged = held.filter(role => role === 'admin' || role === 'institution_admin');
  const switchable = held.filter(isAccountMode);
  if (source?.role === 'admin' || source?.role === 'institution_admin') return unique([...privileged, ...orderedModes(switchable)]);
  if (!switchable.length) return privileged;
  const withLearner = switchable.includes('teacher') || switchable.includes('parent')
    ? unique([...switchable, 'student'])
    : switchable;
  return unique([...privileged, ...orderedModes(withLearner)]);
}

export function switchableModes(source: RoleSource | null | undefined): AccountMode[] {
  if (source?.role === 'admin' || source?.role === 'institution_admin') return [];
  return orderedModes(accountRoles(source));
}

export function canBecomeInstructor(source: RoleSource | null | undefined): boolean {
  if (!source || source.role === 'admin' || source.role === 'institution_admin') return false;
  const roles = accountRoles(source);
  return roles.includes('student') && !roles.includes('teacher');
}

/** Roles a teacher or parent may write so their learner space exists on the server. */
export function learnerSpaceRoles(source: RoleSource | null | undefined): AccountMode[] | null {
  if (source?.role !== 'teacher' && source?.role !== 'parent') return null;
  const desired = orderedModes(accountRoles(source));
  const stored = orderedModes(source.roles ?? []);
  if (desired.length === stored.length && desired.every((role, index) => role === stored[index])) return null;
  return desired;
}

/** Adds teacher and keeps every role they already hold. Never adds admin. */
export function becomeInstructorRoles(source: RoleSource | null | undefined): AccountMode[] | null {
  if (!canBecomeInstructor(source)) return null;
  const next = orderedModes([...accountRoles(source), 'teacher', 'student']);
  if (next.some(role => role !== 'student' && role !== 'teacher' && role !== 'parent')) return null;
  return next;
}

export function instructorOnboarding(
  source: RoleSource | null | undefined,
  input: { headline: string; subject: string; acceptedReview: boolean },
): InstructorOnboarding | null {
  if (!input.acceptedReview) return null;
  const roles = becomeInstructorRoles(source);
  const headline = input.headline.trim();
  const subject = input.subject.trim();
  if (!roles || !headline || !subject) return null;
  return {
    roles,
    instructor: { headline, bio: subject, public: false },
  };
}

export function rememberedMode(stored: string | null | undefined, source: RoleSource | null | undefined): AccountMode {
  const modes = switchableModes(source);
  if (stored && isAccountMode(stored) && modes.includes(stored)) return stored;
  if (source?.role && isAccountMode(source.role) && modes.includes(source.role)) return source.role;
  return modes[0] ?? 'student';
}

export function activeMode(source: RoleSource | null | undefined, stored: string | null | undefined): AccountMode | null {
  const modes = switchableModes(source);
  if (!modes.length) return null;
  return rememberedMode(stored, source);
}

export function homeForMode(mode: AccountMode): string {
  if (mode === 'teacher') return '/dashboard/teacher';
  if (mode === 'parent') return '/dashboard/parent';
  return '/dashboard/student';
}

export function landingPath(source: RoleSource | null | undefined, stored: string | null | undefined): string {
  if (source?.role === 'institution_admin') return '/dashboard/institution';
  if (source?.role === 'admin') return '/dashboard/admin';
  if (source?.role === 'partner_merchant') return '/dashboard/partner';
  const mode = activeMode(source, stored);
  return mode ? homeForMode(mode) : '/dashboard/student';
}

export function dashboardArea(pathname: string): AccountMode | 'admin' | 'institution' | 'shared' {
  if (pathname.startsWith('/dashboard/student')) return 'student';
  if (pathname.startsWith('/dashboard/teacher')) return 'teacher';
  if (pathname.startsWith('/dashboard/parent')) return 'parent';
  if (pathname.startsWith('/dashboard/admin')) return 'admin';
  if (pathname.startsWith('/dashboard/institution')) return 'institution';
  return 'shared';
}

/** Where to send the browser when the open page belongs to another mode. */
export function modeRedirect(pathname: string, mode: AccountMode | null): string | null {
  if (!mode) return null;
  const area = dashboardArea(pathname);
  if (area === 'student' || area === 'teacher' || area === 'parent') {
    return area === mode ? null : homeForMode(mode);
  }
  return null;
}

/**
 * Learning shows this person's enrolments, progress, certificates, and Sparks.
 * A class they teach, or a child they monitor, stays out.
 */
export function forLearnerView<T extends ShelfItem>(items: readonly T[], viewerId: string): T[] {
  return items.filter(item => {
    if (item.childId) return false;
    if (item.studentId && item.studentId !== viewerId) return false;
    if (item.ownerId === viewerId && item.studentId !== viewerId) return false;
    return true;
  });
}

export function readActiveMode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveMode(mode: AccountMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* Private browsing can refuse storage. The next page still opens. */
  }
}
