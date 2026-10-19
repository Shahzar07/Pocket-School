/** Required before a teacher or institution publishes a course online. */

export const COPYRIGHT_VERSION = '2026-10-19';

export const COPYRIGHT_DECLARATION =
  'I declare this course is not copied from another course, and it does not use copyrighted material without a licence. I, not Poket School or the associated school or institution, am liable for infringement.';

export interface CopyrightDeclaration {
  accepted: true;
  uid: string;
  at: number;
  version: string;
  text: string;
}

export function copyrightRecord(uid: string, now = Date.now()): CopyrightDeclaration {
  return {
    accepted: true,
    uid,
    at: now,
    version: COPYRIGHT_VERSION,
    text: COPYRIGHT_DECLARATION,
  };
}

export function copyrightReady(record: { accepted?: boolean; version?: string; uid?: string } | null | undefined): boolean {
  return record?.accepted === true && record.version === COPYRIGHT_VERSION && Boolean(record.uid);
}

export type SignatureContext = 'instructor_application' | 'course_create';

/** Ignore case and extra spaces. The typed name must match the profile name. */
export function namesMatch(typed: string, profileName: string): boolean {
  const fold = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const left = fold(typed);
  const right = fold(profileName);
  return left.length >= 2 && left === right;
}
