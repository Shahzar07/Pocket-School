import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

function openFirestore() {
  const databaseId = firebaseConfig.firestoreDatabaseId;
  // The app reads the same note documents. Persistence lets an edit made
  // offline sync when the browser reconnects. The server render has no cache.
  if (typeof window === 'undefined') return getFirestore(app, databaseId);
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache() }, databaseId);
  } catch {
    return getFirestore(app, databaseId);
  }
}

export const db = openFirestore();
export const auth = getAuth(app);
export const storage = getStorage(app);

// Local end-to-end testing against the Firebase emulators. Never set in
// production, so these connections are inert there.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === '1') {
  const w = window as unknown as { __psEmulators?: boolean };
  if (!w.__psEmulators) {
    w.__psEmulators = true;
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

// Ensure auth session survives page reloads in the browser
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
