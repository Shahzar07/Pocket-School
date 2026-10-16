/**
 * Where the shared module header appears, and where its Home link goes.
 *
 * Standalone modules hide the marketing header. Home sends a visitor to the
 * public site and a signed-in person to the dashboard.
 */

const MODULE_PREFIXES = [
  '/reads',
  '/ai-studio',
  '/ai-teachers',
  '/preview',
  '/mode-preview',
  '/payments-preview',
  '/account-preview',
  '/teacher-studio',
  '/a',
];

const BLOCKED_PREFIXES = [
  '/dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/admin',
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True when this path is a standalone module that has no site navigation. */
export function showsModuleHeader(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (BLOCKED_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) return false;
  return MODULE_PREFIXES.some(prefix => matchesPrefix(pathname, prefix));
}

/** Visitors go to the public home. Signed-in people go to the dashboard. */
export function moduleHomeHref(signedIn: boolean): '/' | '/dashboard' {
  return signedIn ? '/dashboard' : '/';
}
