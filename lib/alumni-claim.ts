/**
 * An individual learner asks to join a school they attended.
 * A registered academy confirms them. An unlisted school stays unverified.
 * The decision never occupies a seat.
 */

import { isMinorTier, type AgeTier } from './age-tier';

export type AlumniClaimStatus = 'needs_parent' | 'verified' | 'pending' | 'unverified' | 'rejected';
export type AlumniClaimMethod = 'roster' | 'domain' | 'admin' | 'peer' | '';

export interface AlumniClaimDecision {
  status: Exclude<AlumniClaimStatus, 'rejected'>;
  method: AlumniClaimMethod;
}

export function validGraduationYear(year: string, todayYear: number): boolean {
  if (!/^\d{4}$/.test(year)) return false;
  const value = Number(year);
  return value >= 1950 && value <= todayYear;
}

export function emailDomainMatches(email: string, domains: readonly string[]): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  if (!domain) return false;
  return domains.some((item) => item.trim().toLowerCase().replace(/^@/, '') === domain);
}

/** A current or former student row counts. A leaver row does not. */
export function rosterCountsForAlumni(row: { role?: string; status?: string } | null | undefined): boolean {
  if (!row || row.role !== 'student') return false;
  return row.status !== 'leaver';
}

/**
 * A minor waits for a parent. A roster or email-domain match is confirmed at once.
 * Anything else at a registered academy waits for an admin. An unlisted school is a peer group.
 */
export function decideAlumniClaim(input: {
  registered: boolean;
  rosterMatch: boolean;
  domainMatch: boolean;
  ageTier: AgeTier;
  parentApproved: boolean;
}): AlumniClaimDecision {
  if (isMinorTier(input.ageTier) && !input.parentApproved) {
    return { status: 'needs_parent', method: '' };
  }
  if (!input.registered) return { status: 'unverified', method: 'peer' };
  if (input.rosterMatch) return { status: 'verified', method: 'roster' };
  if (input.domainMatch) return { status: 'verified', method: 'domain' };
  return { status: 'pending', method: 'admin' };
}

export interface AlumniClaimFields {
  institutionId: string;
  schoolName: string;
  graduationYear: string;
  className: string;
  country: string;
  state: string;
}

export function readAlumniClaim(input: {
  institutionId?: unknown;
  schoolName?: unknown;
  graduationYear?: unknown;
  className?: unknown;
  country?: unknown;
  state?: unknown;
  todayYear: number;
}): AlumniClaimFields | { error: string } {
  const institutionId = typeof input.institutionId === 'string' ? input.institutionId.trim().slice(0, 80) : '';
  const schoolName = typeof input.schoolName === 'string' ? input.schoolName.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  const graduationYear = typeof input.graduationYear === 'string' ? input.graduationYear.trim() : '';
  const className = typeof input.className === 'string' ? input.className.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  const country = typeof input.country === 'string' ? input.country.trim().toUpperCase().slice(0, 2) : '';
  const state = typeof input.state === 'string' ? input.state.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!institutionId && !schoolName) return { error: 'Choose a school or type its name.' };
  if (!validGraduationYear(graduationYear, input.todayYear)) return { error: 'Enter the graduation year.' };
  if (!className) return { error: 'Enter the class.' };
  if (!institutionId && !/^[A-Z]{2}$/.test(country)) return { error: 'Choose the country for that school.' };
  return { institutionId, schoolName, graduationYear, className, country, state };
}
