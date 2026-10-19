import { expect, test, type Page } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';

/** Concrete pages. Route groups drop out of the URL. Dynamic segments get a known id. */
function collect(dir: string, prefix: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const next = name.startsWith('(') && name.endsWith(')') ? prefix : `${prefix}/${name}`;
      collect(full, next, out);
      continue;
    }
    if (name === 'page.tsx') out.push(prefix || '/');
  }
}

const KNOWN_DYNAMIC = [
  '/ai-teachers/et-maths/session',
  '/dashboard/studio/teachers/et-maths',
  '/join/class/JOIN-E2E1',
];

function allRoutes(): string[] {
  const found: string[] = [];
  collect('app', '', found);
  const urls = new Set<string>(KNOWN_DYNAMIC);
  for (const route of found) {
    if (!route.includes('[')) urls.add(route || '/');
  }
  return [...urls].sort();
}

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Accept all' }).click();
  }
}

async function signIn(page: Page, email: string) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await response.json() as { localId?: string; idToken?: string; refreshToken?: string; error?: { message?: string } };
  if (!data.localId || !data.idToken || !data.refreshToken) {
    throw new Error(data.error?.message || 'Emulator sign-in failed');
  }
  const now = Date.now();
  const user = {
    uid: data.localId,
    email,
    emailVerified: false,
    isAnonymous: false,
    providerData: [{ providerId: 'password', uid: email, email, displayName: null }],
    stsTokenManager: { refreshToken: data.refreshToken, accessToken: data.idToken, expirationTime: now + 3_600_000 },
    createdAt: String(now),
    lastLoginAt: String(now),
    apiKey: API_KEY,
    appName: '[DEFAULT]',
  };
  const storageKey = `firebase:authUser:${API_KEY}:[DEFAULT]`;
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ storageKey: key, user: value }) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('firebaseLocalStorageDb');
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('firebaseLocalStorage')) {
          open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
        }
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
        tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { storageKey, user });
}

async function visitAll(page: Page, role: string) {
  const failures: string[] = [];
  for (const path of allRoutes()) {
    let status = 0;
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      status = response?.status() ?? 0;
    } catch (error) {
      failures.push(`${path} navigation failed: ${error instanceof Error ? error.message : 'error'}`);
      continue;
    }
    if (status === 404 || status >= 500) {
      failures.push(`${path} status ${status}`);
      continue;
    }
    const missing = await page.getByText('This page could not be found').count();
    if (missing > 0) {
      failures.push(`${path} rendered not-found`);
      continue;
    }
    // Dashboard routes render a spinner with no text until auth restores, then
    // a role gate may redirect. Wait until the settled page has real text.
    try {
      await page.waitForFunction(
        () => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length >= 12,
        { timeout: 15_000 },
      );
    } catch {
      const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      failures.push(`${path} empty main (${text.length} chars)`);
    }
  }
  expect(failures, `${role} route failures:\n${failures.join('\n')}`).toEqual([]);
}

test.describe('route smoke', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to walk every route on the preview.');
  test.describe.configure({ timeout: 30 * 60 * 1000 });

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const db = adminDb();
    const people = [
      { email: 'student.e2e@poketschool.ai', profile: { role: 'student', name: 'E2E Learner' } },
      { email: 'parent.e2e@poketschool.ai', profile: { role: 'parent', name: 'E2E Parent', childIds: [] as string[] } },
      { email: 'teacher.e2e@poketschool.ai', profile: { role: 'teacher', name: 'E2E Teacher' } },
      { email: 'institution.e2e@poketschool.ai', profile: { role: 'institution_admin', name: 'E2E Institution', institutionId: 'e2e-school' } },
      { email: 'admin.e2e@poketschool.ai', profile: { role: 'admin', adminRole: 'super_admin', name: 'E2E Admin' } },
    ];
    const ids: Record<string, string> = {};
    for (const person of people) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: false });
      }
      ids[person.email] = user.uid;
      await db.collection('users').doc(user.uid).set({
        ...person.profile,
        email: person.email,
        emailVerified: false,
        twoFactorEnabled: false,
      }, { merge: true });
    }
    await db.collection('users').doc(ids['parent.e2e@poketschool.ai']).set({
      childIds: [ids['student.e2e@poketschool.ai']],
    }, { merge: true });
  });

  for (const role of [
    { name: 'student', email: 'student.e2e@poketschool.ai' },
    { name: 'parent', email: 'parent.e2e@poketschool.ai' },
    { name: 'teacher', email: 'teacher.e2e@poketschool.ai' },
    { name: 'institution admin', email: 'institution.e2e@poketschool.ai' },
    { name: 'super admin', email: 'admin.e2e@poketschool.ai' },
  ]) {
    test(`${role.name} can open every page without a 404, 500, or empty main`, async ({ page }) => {
      await signIn(page, role.email);
      await dismissCookies(page);
      await visitAll(page, role.name);
    });
  }
});
