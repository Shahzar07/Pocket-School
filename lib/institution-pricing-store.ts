import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  normalizePriceOverride,
  normalizeVolumeSchedule,
  type InstitutionPriceOverride,
  type InstitutionVolumeSchedule,
} from './institution-pricing';

export interface VolumePricingActor {
  actorId: string;
  actorName: string;
}

export async function loadVolumeSchedule(): Promise<InstitutionVolumeSchedule> {
  try {
    const snap = await getDoc(doc(db, 'institution_pricing', 'current'));
    if (!snap.exists()) return normalizeVolumeSchedule(null);
    return normalizeVolumeSchedule(snap.data());
  } catch {
    return normalizeVolumeSchedule(null);
  }
}

export async function saveVolumeSchedule(next: InstitutionVolumeSchedule, actor: VolumePricingActor): Promise<void> {
  const clean = normalizeVolumeSchedule(next);
  await setDoc(doc(db, 'institution_pricing', 'current'), clean);
  await addDoc(collection(db, 'institution_pricing_audit'), {
    actorId: actor.actorId,
    actorName: actor.actorName,
    at: serverTimestamp(),
    currency: clean.currency,
    tierCount: clean.tiers.length,
  });
}

export async function loadPriceOverride(institutionId: string): Promise<InstitutionPriceOverride> {
  try {
    const snap = await getDoc(doc(db, 'institutions', institutionId, 'pricing', 'current'));
    if (!snap.exists()) return normalizePriceOverride(null);
    return normalizePriceOverride(snap.data());
  } catch {
    return normalizePriceOverride(null);
  }
}

export async function savePriceOverride(institutionId: string, override: InstitutionPriceOverride): Promise<void> {
  await setDoc(doc(db, 'institutions', institutionId, 'pricing', 'current'), normalizePriceOverride(override));
}
