import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const EMAIL = 'admin.e2e@poketschool.ai';
const TITLE = 'E2E journal note';
const SLUG = 'e2e-journal-note';
const IMAGE = 'public/blog/thumbs/igcse-revision-with-et-ai.webp';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.getByRole('button', { name: 'Accept all' }).click().catch(() => undefined);
    await dialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
  }
}

async function signIn(page: Page) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await response.json() as { localId?: string; idToken?: string; refreshToken?: string; error?: { message?: string } };
  if (!data.localId || !data.idToken || !data.refreshToken) {
    throw new Error(data.error?.message || 'Emulator sign-in failed');
  }
  const now = Date.now();
  const user = {
    uid: data.localId,
    email: EMAIL,
    emailVerified: false,
    isAnonymous: false,
    providerData: [{ providerId: 'password', uid: EMAIL, email: EMAIL, displayName: null }],
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
  await page.evaluate(() => localStorage.setItem('poket-pip-onboarded', '1'));
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
}

test.describe('journal editor', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to edit the journal.');

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    let user;
    try {
      user = await auth.getUserByEmail(EMAIL);
      await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
    } catch {
      user = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: false });
    }
    await auth.setCustomUserClaims(user.uid, { role: 'admin', adminRole: 'super_admin' });
    await adminDb().collection('users').doc(user.uid).set({
      role: 'admin',
      adminRole: 'super_admin',
      name: 'E2E Admin',
      email: EMAIL,
      emailVerified: false,
      twoFactorEnabled: false,
    }, { merge: true });
  });

  test('edit opens the essay, formatting and an image survive a reload, and the public page renders them', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/admin/blog', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-tool-shell="1"]')).toHaveCount(0);
    await page.screenshot({ path: 'docs/qa/blog/blog-list-light.png', fullPage: false });
    const draft = page.locator('[data-blog-row="igcse-revision-with-et-ai"]');
    await draft.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/blog\/igcse-revision-with-et-ai\/edit/);
    await expect(page.locator('[data-blog-title="1"]')).toHaveValue(/IGCSE/i);
    const preview = page.locator('[data-blog-preview="1"]');
    const badge = preview.locator('[data-blog-badge="1"]');
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    const previewBox = await preview.boundingBox();
    expect(badgeBox && previewBox).toBeTruthy();
    if (badgeBox && previewBox) {
      expect(badgeBox.y).toBeGreaterThanOrEqual(previewBox.y - 1);
      expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(previewBox.y + previewBox.height + 1);
    }
    const hero = preview.locator('[data-blog-hero="1"]');
    const heroBox = await hero.boundingBox();
    expect(heroBox?.height ?? 0).toBeGreaterThan(200);
    const toDark = page.getByRole('button', { name: 'Switch to dark mode' });
    if (await toDark.isVisible().catch(() => false)) await toDark.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({ path: 'docs/qa/blog/blog-editor-dark.png', fullPage: false });
    await page.locator('[data-blog-seo="1"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/qa/blog/blog-seo-dark.png', fullPage: false });

    await page.goto('/dashboard/admin/blog/new', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-blog-title="1"]').fill(TITLE);
    await expect(page.locator('[data-blog-slug="1"]')).toHaveValue(SLUG);
    const editor = page.locator('[data-blog-editor="1"]');
    await editor.click();
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await page.keyboard.type('Harbour notes for the week.');
    await page.locator('[data-blog-alt="inline"]').fill('A revision card');
    await page.locator('[data-blog-file="inline"]').setInputFiles(IMAGE);
    await expect(page.locator('[data-blog-editor="1"] img, [data-blog-preview="1"] img').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-blog-alt="cover"]').fill('A student revising with ET AI');
    await page.locator('[data-blog-file="cover"]').setInputFiles(IMAGE);
    await expect(page.locator('[data-blog-hero="1"] img')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Question 1').fill('What is this note?');
    await page.getByLabel('Answer 1').fill('A short note from the journal editor.');
    await page.getByLabel('Status').selectOption('published');
    await page.getByRole('button', { name: 'Save essay' }).click();
    await expect(page.getByText('Published.')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/dashboard/admin/blog/${SLUG}/edit`));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-blog-title="1"]')).toHaveValue(TITLE, { timeout: 30_000 });
    await expect(page.locator('[data-blog-editor="1"]')).toContainText('Harbour notes for the week.');
    await expect(page.locator('[data-blog-editor="1"] strong, [data-blog-preview="1"] strong').first()).toBeVisible();
    await expect(page.locator('[data-blog-preview="1"] img').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/qa/blog/blog-editor-dark-mobile.png', fullPage: false });
    await page.setViewportSize({ width: 1280, height: 800 });

    const toLight = page.getByRole('button', { name: 'Switch to light mode' });
    await toLight.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.screenshot({ path: 'docs/qa/blog/blog-editor-light.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/qa/blog/blog-editor-light-mobile.png', fullPage: false });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/blog/${SLUG}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Harbour notes for the week.')).toBeVisible();
    await expect(page.locator('article img, main img').first()).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    await page.screenshot({ path: 'docs/qa/blog/blog-public.png', fullPage: false });
  });
});
