/** Required before a teacher or institution publishes a course online. */

export const COPYRIGHT_VERSION = '2026-10-19';

export const COPYRIGHT_DECLARATION =
  'I confirm this content is original, or that I hold the licences or permission for any copyrighted material. I, not Poket School or the associated school or institution, am liable for infringement unless a licence was granted.';

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
