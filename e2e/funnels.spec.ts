import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const ADMIN = 'admin.e2e@poketschool.ai';
const STUDENT = 'student.e2e@poketschool.ai';
const SHOTS = '/opt/cursor/artifacts/screenshots/funnels';

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((next) => {
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, theme);
}

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    const close = dialog.getByRole('button', { name: 'Close' });
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => undefined);
    else await page.getByRole('button', { name: /Accept all|Terima semua/ }).click().catch(() => undefined);
    await dialog.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
  }
}

async function idToken(email: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await response.json() as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(data.error?.message || 'Emulator sign-in failed');
  return data.idToken;
}

async function signIn(page: Page, email: string) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await response.json() as { localId?: string; idToken?: string; refreshToken?: string; error?: { message?: string } };
  if (!data.localId || !data.idToken || !data.refreshToken) throw new Error(data.error?.message || 'Emulator sign-in failed');
  const now = Date.now();
  const user = {
    uid: data.localId,
    email,
    emailVerified: true,
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
    await new Promise<void>((resolveStore, reject) => {
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
        tx.oncomplete = () => resolveStore();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { storageKey, user });
  await page.evaluate(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
}

test('an unknown public code still shows the alumni record', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/p/not-a-real-student', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Poket School alumni')).toBeVisible();
  await expect(page.getByText('This profile is private. Certificate pages stay available from each certificate QR.')).toBeVisible();
  await expect(page.locator('[data-site-header]')).toHaveCount(0);
  await expect(page.locator('[data-funnel-public]')).toHaveCount(0);
});

test.describe('admin landing pages', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to build a landing page.');
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const people = [
      { email: ADMIN, profile: { role: 'admin', adminRole: 'super_admin', name: 'E2E Admin' } },
      { email: STUDENT, profile: { role: 'student', name: 'E2E Learner' } },
    ];
    for (const person of people) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: true });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: true });
      }
      await adminDb().doc(`users/${user.uid}`).set({ ...person.profile, email: person.email }, { merge: true });
    }
  });

  test('an admin publishes a page, stores a lead, and a student cannot write one', async ({ page }) => {
    const studentToken = await idToken(STUDENT);
    const denied = await page.request.post('/api/funnels', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { action: 'create', template: 'blank' },
    });
    expect(denied.status()).toBe(403);
    const anonymous = await page.request.post('/api/funnels', { data: { action: 'create', template: 'blank' } });
    expect(anonymous.status()).toBe(401);

    const slug = `e2e-funnel-${Date.now().toString(36)}`;
    const heading = `E2E open evening ${slug}`;
    await signIn(page, ADMIN);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setTheme(page, 'light');
    await page.goto('/dashboard/admin/funnels', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-funnel-desk="1"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'New landing page' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Choose template');
    await expect(page.locator('[data-flow-nav]')).toBeVisible();
    await page.getByRole('button', { name: /Course page/ }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Edit sections');
    await page.locator('[data-funnel-desk="1"]').getByLabel('Heading').first().fill(heading);
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Preview');
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Draft preview. This page is not public.')).toBeVisible();
    await expect(page.getByText('A quote appears here only after a learner agrees to be named.')).toBeVisible();
    await expect(page.locator('[data-funnel-public="preview"]').getByText('$79')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/preview-desktop-light.png` });
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SHOTS}/preview-desktop-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/preview-mobile-dark.png` });
    await setTheme(page, 'light');
    await page.screenshot({ path: `${SHOTS}/preview-mobile-light.png` });
    const overflow = await page.locator('[data-funnel-public="preview"]').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    const cyan = await page.locator('[data-funnel-public="preview"] span').first().evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(cyan).toBe('rgb(63, 224, 208)');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Publish');
    await page.getByLabel('Public address').fill(slug);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.locator('[data-funnel-status="published"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/publish-desktop-light.png` });

    await page.goto(`/p/${slug}`, { waitUntil: 'domcontentloaded' });
    const published = page.locator('[data-funnel-public="public"]');
    await expect(published).toBeVisible();
    await expect(page.locator('[data-funnel-live="1"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByText('Poket School alumni')).toHaveCount(0);
    await published.getByLabel('Name').fill('E2E Lead');
    await published.getByLabel('Email').fill('lead.e2e@poketschool.ai');
    await published.getByLabel('Note').fill('Please send the course outline.');
    await expect(published.getByLabel('Name')).toHaveValue('E2E Lead');
    await published.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Sent. The admin who published this page can read it.')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/public-desktop-light.png` });
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SHOTS}/public-desktop-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, 'light');
    await page.screenshot({ path: `${SHOTS}/public-mobile-light.png` });
    const publicOverflow = await page.locator('[data-funnel-public="public"]').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(publicOverflow).toBeLessThanOrEqual(2);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard/admin/funnels', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    const original = page.locator('li', { hasText: new RegExp(`/p/${slug}(?!-)`) });
    await original.getByRole('button', { name: 'Open' }).click();
    await page.locator('[data-flow-trail]').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('[data-funnel-lead="lead.e2e@poketschool.ai"]')).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.locator('[data-funnel-status="draft"]')).toBeVisible();
    await page.goto(`/p/${slug}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('This page is not published.')).toBeVisible();
    await expect(page.getByRole('heading', { name: heading })).toHaveCount(0);
    await expect(page.getByText('Poket School alumni')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/unpublished-desktop-light.png` });

    await page.goto('/dashboard/admin/funnels', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await page.locator('li', { hasText: new RegExp(`/p/${slug}(?!-)`) }).getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Edit sections');
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Choose template');
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'All landing pages' }).click();
    await expect(page.getByText(`${slug}-copy`)).toBeVisible();
  });
});
