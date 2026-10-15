/**
 * Admin-only read of deviceTokens. Firestore rules deny every client read.
 */
import type { DeviceToken, PushStore } from './push';
import firebaseConfig from '../firebase-applet-config.json';

type DocSnap = { id: string; data(): Record<string, unknown> };
type QuerySnap = { docs: DocSnap[] };

type CollectionRef = {
  where(field: string, op: string, value: string): { get(): Promise<QuerySnap> };
  get(): Promise<QuerySnap>;
  doc(id: string): {
    delete(): Promise<unknown>;
    collection(name: string): CollectionRef;
  };
};

type AdminDb = {
  collection(name: string): CollectionRef;
};

let adminDb: AdminDb | null = null;

function mapToken(id: string, data: Record<string, unknown>, fallbackUserId = ''): DeviceToken {
  const keys = data.keys;
  return {
    userId: typeof data.userId === 'string' && data.userId ? data.userId : fallbackUserId,
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
      const [top, nested] = await Promise.all([
        db.collection('deviceTokens').where('userId', '==', userId).get(),
        db.collection('users').doc(userId).collection('deviceTokens').get(),
      ]);
      const byId = new Map<string, DeviceToken>();
      for (const doc of top.docs) byId.set(doc.id, mapToken(doc.id, doc.data(), userId));
      for (const doc of nested.docs) byId.set(doc.id, mapToken(doc.id, doc.data(), userId));
      return [...byId.values()];
    },
    async deleteToken(deviceId, userId) {
      const db = await firestore();
      await db.collection('deviceTokens').doc(deviceId).delete();
      if (userId) await db.collection('users').doc(userId).collection('deviceTokens').doc(deviceId).delete();
    },
  };
}
