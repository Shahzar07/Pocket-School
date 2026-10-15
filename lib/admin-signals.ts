/**
 * Best-effort writes that need the Firebase Admin SDK. They never throw into
 * a user-facing request: a missing service account leaves the signal at zero.
 */

import firebaseConfig from '@/firebase-applet-config.json';
import { loginBlocked } from '@/lib/admin-console';

async function signalDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const existing = getApps()[0];
  const app = existing ?? initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as Record<string, string>),
  });
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export async function noteGenerationFailure(): Promise<void> {
  try {
    const db = await signalDb();
    if (!db) return;
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.collection('platform_signals').doc('health').set({
      generationFailures: FieldValue.increment(1),
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('[health] generation failure was not recorded', err);
  }
}

export async function accountIsBlocked(uid: string): Promise<boolean> {
  try {
    const db = await signalDb();
    if (!db) return false;
    const snap = await db.collection('users').doc(uid).get();
    const status = snap.data()?.accountStatus;
    return loginBlocked(typeof status === 'string' ? status : 'active');
  } catch {
    return false;
  }
}
