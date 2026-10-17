/**
 * Import roster the app reads at institutions/{institutionId}/rosters/{rosterId}.
 * joinRoster stays the seat ledger. This collection is the match list.
 */

import type { RosterEntry } from './institution-join';

export const ROSTER_GENDERS = ['male', 'female'] as const;
export const ROSTER_ROLES = ['student', 'parent'] as const;
export const ROSTER_STATUSES = ['pending', 'matched', 'invited'] as const;

export type RosterGender = (typeof ROSTER_GENDERS)[number];
export type ImportRosterRole = (typeof ROSTER_ROLES)[number];
export type ImportRosterStatus = (typeof ROSTER_STATUSES)[number];

export interface ImportRoster {
  email: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  level: string;
  classId: string;
  gender: RosterGender;
  role: ImportRosterRole;
  status: ImportRosterStatus;
  matchedUid: string;
  importedAt: string;
  importBatchId: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function readImportRoster(value: unknown): ImportRoster | { error: string } {
  if (!value || typeof value !== 'object') return { error: 'A roster row is required.' };
  const raw = value as Record<string, unknown>;
  const email = clip(raw.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return { error: 'A roster row needs an email address.' };
  const firstName = clip(raw.firstName, 80);
  const lastName = clip(raw.lastName, 80);
  const level = clip(raw.level, 40);
  if (!firstName || !lastName || !level) return { error: 'A roster row needs a first name, a last name, and a level.' };
  if (raw.gender !== 'male' && raw.gender !== 'female') return { error: 'Gender is stored as male or female.' };
  if (raw.role !== 'student' && raw.role !== 'parent') return { error: 'Role is student or parent.' };
  if (raw.status !== 'pending' && raw.status !== 'matched' && raw.status !== 'invited') {
    return { error: 'Status is pending, matched, or invited.' };
  }
  const importedAt = clip(raw.importedAt, 40);
  const importBatchId = clip(raw.importBatchId, 80);
  if (!importedAt || !importBatchId) return { error: 'A roster row needs an import time and a batch id.' };
  return {
    email,
    studentNumber: clip(raw.studentNumber, 40),
    firstName,
    lastName,
    level,
    classId: clip(raw.classId, 80),
    gender: raw.gender,
    role: raw.role,
    status: raw.status,
    matchedUid: clip(raw.matchedUid, 128),
    importedAt,
    importBatchId,
  };
}

/** A matchable seat-ledger row. Status stays pending so this list does not occupy a seat. */
export function importRosterAsJoinEntry(row: ImportRoster): RosterEntry {
  return {
    email: row.email,
    name: `${row.firstName} ${row.lastName}`.trim(),
    role: row.role,
    studentId: row.studentNumber,
    dob: '',
    level: row.level,
    className: row.classId,
    phone: '',
    childStudentId: '',
    programmeId: '',
    claimToken: '',
    status: 'pending',
  };
}
