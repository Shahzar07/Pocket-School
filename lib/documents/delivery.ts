const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SMTP_MISSING =
  'Email is not set up yet. Add an SMTP host, user, and SMTP_PASS. Download PDF still works.';

export function smtpConfigured(env: { host?: string; user?: string; pass?: string }): boolean {
  return Boolean(env.host?.trim() && env.user?.trim() && env.pass?.trim());
}

export function parseAddresses(raw: string): { ok: true; emails: string[] } | { ok: false; error: string } {
  const parts = raw.split(/[,;\n]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return { ok: true, emails: [] };
  const bad = parts.find((part) => !EMAIL.test(part) || part.length > 120);
  if (bad) return { ok: false, error: `${bad} is not an email address.` };
  return { ok: true, emails: [...new Set(parts)].slice(0, 10) };
}

export function recipientList(
  holders: Array<string | undefined>,
  includeHolder: boolean,
  extra: string[],
): string[] {
  const fromAccounts = includeHolder
    ? holders.map((email) => email?.trim().toLowerCase()).filter((email): email is string => Boolean(email))
    : [];
  return [...new Set([...fromAccounts, ...extra])].slice(0, 12);
}
