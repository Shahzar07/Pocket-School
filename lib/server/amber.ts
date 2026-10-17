/**
 * Free Amber opt-in and the referral code the share card carries.
 * referrals/{code} is the same collection a free card uses.
 * No subscription and no school are required.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { referralCode } from '../payments/coupons';
import { adminDb } from '../firebase-admin';
import { amberOptInPatch } from '../amber/public';
import { ActionError } from './actions';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function ensureAmberReferral(uid: string, name: string): Promise<string> {
  const owned = await db().collection('referrals').where('ownerUid', '==', uid).limit(1).get();
  if (!owned.empty) return owned.docs[0].id;
  let code = referralCode(name || 'Poket', uid.slice(0, 4));
  const taken = await db().doc(`referrals/${code}`).get();
  if (taken.exists && str(taken.data()?.ownerUid) !== uid) {
    code = referralCode(name || 'Poket', uid.slice(0, 8));
  }
  await db().doc(`referrals/${code}`).set({
    code,
    ownerUid: uid,
    kind: 'amber',
    createdAt: Date.now(),
    signups: 0,
  });
  return code;
}

async function claimReferral(code: string): Promise<void> {
  const clean = code.trim().slice(0, 32);
  if (!clean) return;
  const ref = db().doc(`referrals/${clean}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.set({ signups: FieldValue.increment(1) }, { merge: true });
}

export async function setAmberOptIn(uid: string, input: {
  country?: string;
  state?: string;
  city?: string;
  homeCountry?: string;
  optIn?: boolean;
  referral?: string;
}): Promise<{ emergencyOptIn: boolean; homeCountry: string }> {
  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  if (input.optIn === false) {
    await ref.set({ emergencyOptIn: false, updatedAt: Date.now() }, { merge: true });
    return { emergencyOptIn: false, homeCountry: str(snap.data()?.homeCountry) };
  }
  const built = amberOptInPatch({
    country: str(input.country),
    state: str(input.state),
    city: str(input.city),
    homeCountry: str(input.homeCountry),
  });
  if (!built.ok) throw new ActionError('BAD_REQUEST', built.error);
  const data = snap.data() ?? {};
  const code = str(input.referral).slice(0, 32);
  const already = str(data.referredBy);
  const extra: Record<string, unknown> = {};
  if (code && !already) {
    extra.referredBy = code;
    await claimReferral(code);
  }
  await ref.set({ ...built.patch, ...extra, updatedAt: Date.now() }, { merge: true });
  return { emergencyOptIn: true, homeCountry: built.patch.homeCountry };
}
