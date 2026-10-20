import { expect, test, type Page } from '@playwright/test';
import { buildAdminTask } from '../lib/admin/tasks';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';

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
  await page.addInitScript(() => {
    window.localStorage.setItem('poket-pip-onboarded', '1');
  });
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

test('action centre lists a registration and assigns it', async ({ page }) => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to open the Action Centre against the emulator.');
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  const email = 'admin.e2e@poketschool.ai';
  const auth = adminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, emailVerified: false });
  }
  const db = adminDb();
  await db.collection('users').doc(user.uid).set({
    role: 'admin',
    adminRole: 'super_admin',
    name: 'E2E Admin',
    email,
    emailVerified: false,
    twoFactorEnabled: false,
  }, { merge: true });
  const task = buildAdminTask({
    type: 'registration',
    entityType: 'join_requests',
    entityPath: 'institutions/e2e-school/join_requests/learner',
    title: 'Student registration',
    summary: 'A student registration is waiting. Review, approve, or assign a class.',
    priority: 'high',
    scope: { institutionId: 'e2e-school' },
    now: Date.now(),
  });
  await db.collection('admin_tasks').doc(task.id).set(task);
  await signIn(page, email);
  await page.evaluate(() => window.localStorage.setItem('theme', 'dark'));
  await page.goto('/dashboard/admin/tasks', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'Action Centre' })).toBeVisible();
  await expect(page.getByText('Student registration').first()).toBeVisible();
  await page.getByRole('button', { name: 'Assign to me' }).first().click();
  await expect(page.locator('[data-task-status="claimed"]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/action-centre-dark.png', fullPage: true });
  await page.evaluate(() => window.localStorage.setItem('theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'Action Centre' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/action-centre-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/action-centre-light-mobile.png', fullPage: true });
});
