import { adminDb } from '@/lib/firebase-admin';
import {
  builtinDesigns,
  normaliseDesign,
  type CertificateDesign,
} from '@/lib/certificates/design';

function fromDoc(id: string, data: Record<string, unknown>): CertificateDesign {
  return normaliseDesign({ ...(data as Partial<CertificateDesign>), id });
}

export async function listDesigns(institutionId: string | null): Promise<CertificateDesign[]> {
  const snap = await adminDb().collection('certificate_designs').limit(40).get();
  const stored = snap.docs.map((doc) => fromDoc(doc.id, doc.data() as Record<string, unknown>));
  const builtins = builtinDesigns().filter((item) => !stored.some((row) => row.id === item.id));
  const all = [...builtins, ...stored];
  if (!institutionId) return all;
  return all.filter((item) => !item.institutionId || item.institutionId === institutionId);
}

export async function saveDesign(input: Partial<CertificateDesign>, actorId: string): Promise<CertificateDesign> {
  const design = normaliseDesign(input);
  if (!design.id || design.id.length < 2) throw new Error('Name the template.');
  if (design.institutionId) design.isDefault = false;
  const ref = adminDb().doc(`certificate_designs/${design.id}`);
  if (design.isDefault) {
    const current = await adminDb().collection('certificate_designs').where('isDefault', '==', true).limit(10).get();
    const batch = adminDb().batch();
    for (const doc of current.docs) {
      if (doc.id !== design.id) batch.set(doc.ref, { isDefault: false }, { merge: true });
    }
    batch.set(ref, { ...design, updatedBy: actorId, updatedAt: Date.now() });
    await batch.commit();
    return design;
  }
  await ref.set({ ...design, updatedBy: actorId, updatedAt: Date.now() });
  return design;
}
