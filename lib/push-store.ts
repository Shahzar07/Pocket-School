/**
 * Admin-only read of deviceTokens. Firestore rules deny every client read.
 */
import type { DeviceToken, PushStore } from './push';
import firebaseConfig from '../firebase-applet-config.json';

type AdminDb = {
  collection(name: string): {
    where(field: string, op: string, value: string): {
      get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> }> }>;
    };
    doc(id: string): { delete(): Promise<unknown> };
  };
};

let adminDb: AdminDb | null = null;

function mapToken(id: string, data: Record<string, unknown>): DeviceToken {
  const keys = data.keys;
  return {
    userId: typeof data.userId === 'string' ? data.userId : '',
    token: typeof data.token === 'string' ? data.token : '',
    platform: typeof data.platform === 'string' ? data.platform : '',
    provider: typeof data.provider === 'string' ? data.provider : '',
    deviceId: typeof data.deviceId === 'string' && data.deviceId ? data.deviceId : id,
    keys: keys && typeof keys === 'object' ? keys as DeviceToken['keys'] : null,
    prefs: data.prefs && typeof data.prefs === 'object' ? data.prefs as DeviceToken['prefs'] : null,
    app: typeof data.app === 'string' ? data.app : null,
    updatedAt: data.updatedAt,
  };
}

async function firestore(): Promise<AdminDb> {
  if (adminDb) return adminDb;
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const existing = getApps()[0];
  const app = existing ?? initializeApp(
    process.env.FIREBASE_SERVICE_ACCOUNT
      ? { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as Record<string, string>) }
      : { projectId: firebaseConfig.projectId },
  );
  adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId) as unknown as AdminDb;
  return adminDb;
}

export function adminPushStore(): PushStore {
  return {
    async listForUser(userId) {
      const db = await firestore();
      const snap = await db.collection('deviceTokens').where('userId', '==', userId).get();
      return snap.docs.map(doc => mapToken(doc.id, doc.data()));
    },
    async deleteToken(deviceId) {
      const db = await firestore();
      await db.collection('deviceTokens').doc(deviceId).delete();
    },
  };
}
