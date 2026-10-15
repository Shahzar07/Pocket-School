/**
 * Institution OEM licences.
 * A school licenses programmes for a seat count and a term, then wears its
 * own name on the academy, the invitation, and the certificate.
 */

export interface OemLicence {
  id?: string;
  institutionId: string;
  programmeIds: string[];
  seats: number;
  seatsUsed: number;
  /** Inclusive YYYY-MM-DD. */
  startsOn: string;
  endsOn: string;
  currency: string;
  /** Amount captured from the pricing config when the licence was created. */
  amount: number;
  allowOwnCourses: boolean;
  status: 'active' | 'suspended';
}

export type LicencePhase = 'pending' | 'active' | 'full' | 'expired' | 'suspended';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function licencePhase(licence: Pick<OemLicence, 'status' | 'startsOn' | 'endsOn' | 'seats' | 'seatsUsed'>, today: string): LicencePhase {
  if (licence.status === 'suspended') return 'suspended';
  if (!DATE.test(licence.startsOn) || !DATE.test(licence.endsOn) || !DATE.test(today)) return 'expired';
  if (today < licence.startsOn) return 'pending';
  if (today > licence.endsOn) return 'expired';
  if (licence.seatsUsed >= licence.seats) return 'full';
  return 'active';
}

export function programmeLicensed(
  licence: OemLicence,
  programmeId: string,
  today: string,
): boolean {
  const phase = licencePhase(licence, today);
  return (phase === 'active' || phase === 'full') && licence.programmeIds.includes(programmeId);
}

export function seatsRemaining(licence: Pick<OemLicence, 'seats' | 'seatsUsed'>): number {
  return Math.max(0, licence.seats - licence.seatsUsed);
}

export interface InviteRow {
  email: string;
  name: string;
  role: 'student' | 'teacher';
}

export interface InviteParse {
  rows: InviteRow[];
  errors: string[];
}

/** CSV with optional header `email,name,role`. Role defaults to student. */
export function parseInviteCsv(text: string): InviteParse {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows: InviteRow[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    if (index === 0 && /^e-?mail\b/i.test(line)) return;
    const [emailRaw = '', nameRaw = '', roleRaw = ''] = line.split(',').map(part => part.trim());
    const email = emailRaw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Line ${index + 1} needs an email address.`);
      return;
    }
    const role = roleRaw.toLowerCase() === 'teacher' ? 'teacher' : roleRaw.toLowerCase() === 'student' || roleRaw === '' ? 'student' : null;
    if (!role) {
      errors.push(`Line ${index + 1}: role must be student or teacher.`);
      return;
    }
    rows.push({ email, name: nameRaw || email, role });
  });
  return { rows, errors };
}

const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeJoinCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += JOIN_ALPHABET[Math.floor(random() * JOIN_ALPHABET.length) % JOIN_ALPHABET.length];
  }
  return code;
}

export interface AcademyBrand {
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  emailFromName?: string;
  certificateIssuer?: string;
}

export function brandedInvite(brand: AcademyBrand, joinCode: string, origin: string): { subject: string; text: string } {
  const school = brand.displayName || 'Poket School';
  return {
    subject: `${school} invited you`,
    text: [
      `${brand.emailFromName || school} invited you to ${school}.`,
      `Join at ${origin} with the code ${joinCode}.`,
      'Poket School runs the academy. Your school chose the programmes.',
    ].join('\n'),
  };
}

export function certificateBrandLine(brand: AcademyBrand): string {
  return brand.certificateIssuer || brand.displayName || 'Poket School';
}

/** A custom hostname, or null when the value is empty or still a Poket School host. */
export function normaliseCustomDomain(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  if (!host || !host.includes('.') || host.endsWith('.poketschool.ai') || host === 'poketschool.ai' || host === 'localhost') {
    return null;
  }
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}
