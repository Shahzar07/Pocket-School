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

/** Prefer an address already on the document. Otherwise use the account looked up for that student. */
export function holderAddress(
  doc: { holderEmail?: string; studentId?: string },
  lookup: (studentId: string) => string | undefined,
): string | undefined {
  const typed = doc.holderEmail?.trim();
  if (typed && typed.includes('@')) return typed;
  if (!doc.studentId) return undefined;
  const found = lookup(doc.studentId)?.trim();
  return found || undefined;
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

export interface Deliverable {
  id: string;
  title: string;
  filename: string;
  lines: string[];
  holderEmail?: string;
  studentId?: string;
}

export function deliveryAllowed(input: {
  role: string;
  actorId: string;
  childIds?: string[];
  taughtStudentIds?: string[];
  studentIds: string[];
  actorInstitutionId?: string;
  documentInstitutionId?: string;
}): { ok: true } | { ok: false; error: string } {
  const students = [...new Set(input.studentIds.filter(Boolean))];
  if (input.role === 'admin') return { ok: true };
  if (students.length > 0 && students.every((id) => id === input.actorId)) return { ok: true };
  if (input.role === 'institution_admin') {
    if (!input.documentInstitutionId || input.documentInstitutionId !== input.actorInstitutionId) {
      return { ok: false, error: 'That document is outside this institution.' };
    }
    return { ok: true };
  }
  if (!students.length) return { ok: false, error: 'Choose the student this document belongs to.' };
  if (input.role === 'parent') {
    const children = new Set(input.childIds ?? []);
    if (students.every((id) => id === input.actorId || children.has(id))) return { ok: true };
    return { ok: false, error: 'Parents can send documents only for a linked child.' };
  }
  if (input.role === 'teacher') {
    const taught = new Set(input.taughtStudentIds ?? []);
    if (students.every((id) => taught.has(id))) return { ok: true };
    return { ok: false, error: 'Teachers can send documents only for their own students.' };
  }
  if (students.every((id) => id === input.actorId)) return { ok: true };
  return { ok: false, error: 'You can send only your own documents.' };
}
