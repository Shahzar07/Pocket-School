import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, connectAuthEmulator } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const emulator = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === '1';

let realDb: Firestore | null = null;
let firestoreOpened = false;

/** True once a caller has actually touched Firestore. Importing this module does not open it. */
export function firestoreConnectionStarted(): boolean {
  return firestoreOpened;
}

function openFirestore(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId;
  // The app reads the same note documents. Persistence lets an edit made
  // offline sync when the browser reconnects. The server render has no cache.
  let store: Firestore;
  if (typeof window === 'undefined') {
    store = getFirestore(app, databaseId);
  } else {
    // IndexedDB persistence asserts against the emulator when a listener errors.
    const localCache = emulator ? memoryLocalCache() : persistentLocalCache();
    try {
      store = initializeFirestore(app, { localCache }, databaseId);
    } catch {
      store = getFirestore(app, databaseId);
    }
  }
  // Must run before any read. A logged-out page that never calls this stays offline.
  if (emulator) connectFirestoreEmulator(store, '127.0.0.1', 8080);
  return store;
}

function ensureFirestore(): Firestore {
  if (!realDb) {
    firestoreOpened = true;
    realDb = openFirestore();
  }
  return realDb;
}

/**
 * A real Firestore instance, created on the first property read.
 * `instanceof Firestore` holds before that read, so `doc(db, …)` still type-checks,
 * and the logged-out landing page does not open a backend connection.
 */
export const db: Firestore = new Proxy(Object.create(Firestore.prototype) as Firestore, {
  get(_target, prop) {
    const live = ensureFirestore();
    const value = Reflect.get(live, prop, live) as unknown;
    return typeof value === 'function' ? value.bind(live) : value;
  },
  set(_target, prop, value) {
    Reflect.set(ensureFirestore(), prop, value);
    return true;
  },
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// Local end-to-end testing against the Firebase emulators. Never set in
// production, so these connections are inert there. Firestore joins on first use.
if (emulator) {
  const w = window as unknown as { __psEmulators?: boolean };
  if (!w.__psEmulators) {
    w.__psEmulators = true;
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

// Ensure auth session survives page reloads in the browser
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
