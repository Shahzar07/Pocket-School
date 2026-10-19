import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  const accept = page.getByRole('button', { name: 'Accept all' });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await accept.click({ force: true }).catch(() => undefined);
    await dialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
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
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
}

async function chatOn(page: Page, path: string, shot: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  const box = page.getByRole('textbox', { name: 'Message ET AI' });
  try {
    await expect(box).toBeVisible({ timeout: 60_000 });
  } catch (error) {
    const text = await page.locator('body').innerText().catch(() => '');
    throw new Error(`${page.url()}\n${text.slice(0, 800)}\n${error instanceof Error ? error.message : 'textbox missing'}`);
  }
  await expect(page.locator('[data-et-teacher]')).toBeVisible();
  await expect(page.locator('[data-mic="1"]')).toBeVisible();
  await expect(page.locator('[data-attach="1"]')).toBeVisible();
  await expect(page.locator('[data-photo-file="1"]')).toBeAttached();
  await expect(page.locator('[data-camera-file="1"]')).toBeAttached();
  await expect(page.locator('[data-file="1"]')).toBeVisible();
  await page.getByRole('button', { name: 'Explain quadratic equations' }).click();
  const reply = page.locator('[data-assistant="1"]').last();
  await expect(reply).toBeVisible({ timeout: 60_000 });
  await expect(reply).not.toHaveText('');
  await expect(page.getByRole('button', { name: 'Read aloud' }).last()).toBeVisible();
  await dismissCookies(page);
  await page.locator('[data-mic="1"]').click();
  await expect(page.locator('[data-voice-status="1"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-photo-file="1"]').setInputFiles('public/blog/thumbs/igcse-revision-with-et-ai.webp');
  await expect(page.locator('[data-photo-pending="1"]')).toBeVisible();
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${shot}-composer.png`, fullPage: false });
  await box.fill('What is two plus two? Read the attached photo if you can.');
  await dismissCookies(page);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('[data-assistant="1"]').last()).toBeVisible({ timeout: 60_000 });
  for (const tab of ['AI Teachers', 'ET Maths', 'ET Exams', 'ET Essays', 'ET AI']) {
    await dismissCookies(page);
    await page.getByRole('navigation', { name: 'AI Studio' }).getByRole('link', { name: tab }).click();
    await expect(page.getByText('This page could not be found')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveText('');
  }
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${shot}-reply.png`, fullPage: false });
}

test('signed-out studio leaves the spinner and opens login', async ({ page }) => {
  await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return window.location.pathname.startsWith('/login') || Boolean(document.querySelector('.animate-spin'));
  }, undefined, { timeout: 45_000 });
  const started = Date.now();
  await page.waitForURL(/\/login(?:\?|#|$)/, { timeout: 30_000 });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(30_000);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('.animate-spin')).toHaveCount(0);
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-signed-out-login.png', fullPage: false });
  console.log(`signed-out studio left the spinner for login in ${elapsed}ms`);
});

async function proveStudio(page: Page, email: string, shot: string) {
  await signIn(page, email);
  await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  const box = page.getByRole('textbox', { name: 'Message ET AI' });
  await expect(box).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-studio-home="chat"]')).toBeVisible();
  const mic = page.locator('[data-mic="1"]');
  const attach = page.locator('[data-attach="1"]');
  await expect(mic).toBeVisible();
  await expect(attach).toBeVisible();
  await dismissCookies(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await attach.click({ force: true });
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles('public/blog/thumbs/igcse-revision-with-et-ai.webp');
  await expect(page.locator('[data-photo-pending="1"]')).toBeVisible();
  await expect(page.getByText('Photo attached')).toBeVisible();
  await box.fill('What is two plus two?');
  await page.locator('[data-studio-home="chat"]').screenshot({ path: `/opt/cursor/artifacts/screenshots/${shot}-attach.png` });
  await dismissCookies(page);
  await page.getByRole('button', { name: 'Send' }).click();
  const reply = page.locator('[data-assistant="1"]').last();
  await expect(reply).toBeVisible({ timeout: 60_000 });
  await expect(reply).toContainText(/OPENROUTER_API_KEY|model key|cannot reply|two|4|four/i);
  await expect(page.getByRole('paragraph').filter({ hasText: 'What is two plus two?' })).toBeVisible();
  await expect(mic).toBeVisible();
  await expect(attach).toBeVisible();
  await page.locator('[data-studio-home="chat"]').screenshot({ path: `/opt/cursor/artifacts/screenshots/${shot}-chat.png` });
}

test.describe('ET AI studio chat', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to run studio chat against the preview.');
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const db = adminDb();
    for (const person of [
      { email: 'student.e2e@poketschool.ai', role: 'student', name: 'E2E Learner' },
      { email: 'teacher.e2e@poketschool.ai', role: 'teacher', name: 'E2E Teacher' },
    ]) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: false });
      }
      await db.collection('users').doc(user.uid).set({
        role: person.role,
        name: person.name,
        email: person.email,
        emailVerified: false,
        twoFactorEnabled: false,
      }, { merge: true });
    }
  });

  test('student composer sends, and mic and photo controls answer', async ({ page }) => {
    await signIn(page, 'student.e2e@poketschool.ai');
    await chatOn(page, '/dashboard/studio', 'studio-student');
  });

  test('teacher composer sends on the ET page', async ({ page }) => {
    await signIn(page, 'teacher.e2e@poketschool.ai');
    await chatOn(page, '/dashboard/studio/et', 'studio-teacher');
  });

  test('student studio home shows chat, mic, and attach', async ({ page }) => {
    await proveStudio(page, 'student.e2e@poketschool.ai', 'studio-student-proof');
  });

  test('teacher studio home shows chat, mic, and attach', async ({ page }) => {
    await proveStudio(page, 'teacher.e2e@poketschool.ai', 'studio-teacher-proof');
  });
});
