import 'server-only';

import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { normalizeCatalogue, type InstitutionCatalogue } from '@/lib/institution-catalogue';

export async function loadInstitutionCatalogue(): Promise<InstitutionCatalogue> {
  if (!isAdminConfigured()) return normalizeCatalogue(null);
  const snap = await adminDb().doc('institution_catalogue/current').get();
  return normalizeCatalogue(snap.exists ? snap.data() : null);
}

function activityMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

/** Students of this academy who have signed in on or after the period start. */
export async function countActiveStudents(institutionId: string, periodStartIso: string): Promise<number> {
  if (!isAdminConfigured() || !institutionId) return 0;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(periodStartIso) ? Date.parse(`${periodStartIso}T00:00:00.000Z`) : 0;
  const snap = await adminDb().collection('users').where('institutionId', '==', institutionId).limit(500).get();
  let count = 0;
  for (const row of snap.docs) {
    if (row.get('role') !== 'student') continue;
    const seen = activityMillis(row.get('lastActiveAt') ?? row.get('lastSeen'));
    if (seen >= start) count += 1;
  }
  return count;
}
