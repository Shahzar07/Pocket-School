import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const ROLE_JOURNEY = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const TITLE = 'E2E Harbour Notes';

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
  await page.goto('/login', { waitUntil: 'load' });
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
  await page.goto('/dashboard', { waitUntil: 'load' });
  await dismissCookies(page);
}

test.describe('AI Book Creator previews', () => {
  test.skip(!ROLE_JOURNEY, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to run these against the preview.');

  test.beforeAll(async () => {
    if (!ROLE_JOURNEY) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const email = 'admin.e2e@poketschool.ai';
    let user;
    try {
      user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
    } catch {
      user = await auth.createUser({ email, password: PASSWORD, emailVerified: false });
    }
    await adminDb().collection('users').doc(user.uid).set({
      role: 'admin',
      adminRole: 'super_admin',
      name: 'E2E Admin',
      email,
      emailVerified: false,
      twoFactorEnabled: false,
    }, { merge: true });
  });

  test('a super admin covers, previews, publishes, and finds the book on PoketReads', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, 'admin.e2e@poketschool.ai');
    await page.goto('/dashboard/admin/books', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: /Book Studio|AI Book Creator|Studio/i }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'New book with ET AI' }).click();
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(TITLE);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.locator('textarea').last().fill('The harbour was blue at dawn.');
    await page.getByRole('button', { name: 'Cover', exact: true }).click();
    await expect(page.locator('[data-cover-fallback="1"]')).toBeVisible();
    await page.locator('[data-cover-alt="1"]').fill('A blue harbour at dawn');
    await page.locator('[data-cover-file="1"]').setInputFiles('public/blog/thumbs/igcse-revision-with-et-ai.webp');
    await expect(page.locator('[data-cover-preview="1"] img')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-cover-fallback="1"]')).toHaveCount(0);
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-cover-preview.png', fullPage: true });

    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.locator('[data-reader-preview="1"]')).toContainText('harbour was blue');
    await page.locator('[data-device="phone"]').click();
    await page.locator('[data-device="tablet"]').click();
    await page.locator('[data-device="desktop"]').click();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-reader-preview.png', fullPage: true });

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('[data-library-preview="1"]')).toContainText(TITLE);
    await expect(page.locator('[data-detail-preview="1"]')).toContainText(TITLE);
    await expect(page.locator('[data-price="1"]')).toBeVisible();
    await expect(page.locator('[data-reading-time="1"]')).toBeVisible();
    await expect(page.locator('[data-book-status="draft"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-library-preview.png', fullPage: true });

    await page.getByRole('button', { name: 'Preview as student' }).click();
    await expect(page.locator('[data-student-preview="1"]')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-student-preview.png', fullPage: false });
    await page.getByRole('button', { name: 'Close preview' }).click();

    await page.locator('[data-publish-book="1"]').click();
    await expect(page.locator('[data-book-status="published"]')).toBeVisible({ timeout: 20_000 });

    await page.goto('/reads', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-on-reads.png', fullPage: true });
  });
});
