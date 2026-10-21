import 'server-only';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { parsePathway, pathwayBySlug, type PathwayRecord, type PathwaySlug } from '@/lib/pathways/catalog';

/** File catalogue, replaced by a valid admin save when the Admin SDK can read it. */
export async function loadPathway(slug: PathwaySlug): Promise<PathwayRecord> {
  const fallback = pathwayBySlug(slug);
  if (!fallback) throw new Error('Unknown pathway');
  if (!isAdminConfigured()) return fallback;
  try {
    const snap = await adminDb().collection('pathwayPages').doc(slug).get();
    if (!snap.exists) return fallback;
    return parsePathway(snap.data(), slug) ?? fallback;
  } catch (error) {
    console.error('[pathways] read', error);
    return fallback;
  }
}
