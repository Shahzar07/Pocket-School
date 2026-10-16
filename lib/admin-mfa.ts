import { resolveStaffRole, type StaffRole } from './admin-console';

/** Second factors offered when email codes cannot be sent. */
export const MFA_FALLBACKS = ['google', 'totp'] as const;
export type MfaFallback = (typeof MFA_FALLBACKS)[number];

export const SMTP_NOT_CONFIGURED = 'SMTP_NOT_CONFIGURED';

/** Comma-separated SUPER_ADMIN_EMAILS. Blank entries and values without @ are dropped. */
export function parseEmailAllowlist(raw: string | null | undefined): string[] {
  const emails = (raw ?? '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.includes('@') && !item.includes(' '));
  return [...new Set(emails)];
}

export function staffRoleForMfa(input: {
  email: string;
  role?: unknown;
  adminRole?: unknown;
}): StaffRole | null {
  return resolveStaffRole({
    email: input.email,
    role: typeof input.role === 'string' ? input.role : '',
    adminRole: typeof input.adminRole === 'string' ? input.adminRole : '',
  });
}

/**
 * Google and authenticator are a replacement for the email code, not a way
 * around it. Only an allowlisted super admin gets them, and only when SMTP
 * cannot send the code.
 */
export function smtpFallbackFactors(input: {
  email: string;
  allowlist: readonly string[];
  staffRole: StaffRole | null;
}): MfaFallback[] {
  const email = input.email.trim().toLowerCase();
  if (!email || input.staffRole !== 'super_admin') return [];
  if (!input.allowlist.includes(email)) return [];
  return ['google', 'totp'];
}

export function parseFallbackFactors(value: unknown): MfaFallback[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MfaFallback => item === 'google' || item === 'totp');
}
