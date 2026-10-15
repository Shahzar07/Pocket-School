import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let cached: App | undefined;

/**
 * Admin SDK is available when a service account is set, Application Default
 * Credentials exist, or the Firestore emulator is running.
 */
export function isAdminConfigured(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.FIRESTORE_EMULATOR_HOST
  );
}

export function adminApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) {
    cached = existing;
    return existing;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const parsed = JSON.parse(raw) as { project_id?: string };
    cached = initializeApp({
      credential: cert(JSON.parse(raw)),
      projectId: parsed.project_id || projectId,
    });
    return cached;
  }
  cached = initializeApp({ projectId });
  return cached;
}

/** Named database from firebase-applet-config.json, not the `(default)` database. */
export function adminDb(): Firestore {
  return getFirestore(adminApp(), firebaseConfig.firestoreDatabaseId);
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
