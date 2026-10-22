import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const ADMIN = 'admin.e2e@poketschool.ai';
const STUDENT = 'student.e2e@poketschool.ai';
const PARENT = 'parent.e2e@poketschool.ai';
const UNLINKED = 'parent.results.e2e@poketschool.ai';
const TEACHER = 'teacher.e2e@poketschool.ai';
const SCHOOL = 'institution.e2e@poketschool.ai';
const SHOTS = '/opt/cursor/artifacts/screenshots/results';
const DISCLAIMER = 'Exam boards award these grades. Poket School records them.';

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
    localStorage.setItem('theme', 'light');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
}

test('an unknown results portfolio stays private', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/results/not-a-real-token', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await expect(page.getByText('This portfolio is private.')).toBeVisible();
  await expect(page.getByText(/Poket School awards/i)).toHaveCount(0);
  await expect(page.locator('[data-site-header]')).toHaveCount(0);
  await expect(page.locator('[data-results-public="private"]')).toBeVisible();
  const api = await page.request.get('/api/results');
  expect([401, 503]).toContain(api.status());
});

test.describe('academic results', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to record a result.');
  test.describe.configure({ timeout: 240_000 });
  let studentId = '';

  test.beforeAll(async () => {
    if (!LIVE) return;
    mkdirSync(SHOTS, { recursive: true });
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
    const auth = adminAuth();
    const people = [
      { email: ADMIN, profile: { role: 'admin', adminRole: 'super_admin', name: 'E2E Admin' } },
      { email: STUDENT, profile: { role: 'student', name: 'E2E Learner' } },
      { email: PARENT, profile: { role: 'parent', name: 'E2E Parent', childIds: [] as string[] } },
      { email: UNLINKED, profile: { role: 'parent', name: 'E2E Unlinked', childIds: [] as string[] } },
      { email: TEACHER, profile: { role: 'teacher', name: 'E2E Teacher', roles: ['teacher'] } },
      { email: SCHOOL, profile: { role: 'institution_admin', name: 'E2E School', institutionId: 'e2e-school-results' } },
    ];
    const ids = new Map<string, string>();
    for (const person of people) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: true });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: true });
      }
      ids.set(person.email, user.uid);
      await adminDb().doc(`users/${user.uid}`).set({ ...person.profile, email: person.email }, { merge: true });
    }
    studentId = ids.get(STUDENT) ?? '';
    await adminDb().doc(`users/${ids.get(PARENT)}`).set({ childIds: [studentId] }, { merge: true });
  });

  test('a learner records a result, a parent can read it, and a school verifies it', async ({ page }) => {
    const stamp = Date.now().toString(36);
    const subject = `Mathematics ${stamp}`;
    const session = `May/June ${stamp}`;
    const studentToken = await idToken(STUDENT);
    const teacherToken = await idToken(TEACHER);
    const schoolToken = await idToken(SCHOOL);
    const unlinkedToken = await idToken(UNLINKED);
    const forced = await page.request.post('/api/results', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { action: 'save', level: 'IGCSE', subject: `Physics ${stamp}`, board: 'Cambridge International', grade: 'A', session, status: 'verified' },
    });
    expect(forced.status()).toBe(200);
    const forcedBody = await forced.json() as { status?: string };
    expect(forcedBody.status).toBe('self-reported');

    const teacher = await page.request.get('/api/results', { headers: { Authorization: `Bearer ${teacherToken}` } });
    expect(teacher.status()).toBe(403);
    const schoolDenied = await page.request.post('/api/results', {
      headers: { Authorization: `Bearer ${schoolToken}` },
      data: { action: 'verify', id: 'missing-result' },
    });
    expect([403, 404]).toContain(schoolDenied.status());
    const stranger = await page.request.get(`/api/results?student=${studentId}`, { headers: { Authorization: `Bearer ${unlinkedToken}` } });
    expect(stranger.status()).toBe(403);

    await signIn(page, STUDENT);
    await page.evaluate(() => {
      localStorage.setItem('pocket-school-lang', 'ms');
      localStorage.setItem('pocket-school-lang-source', 'user');
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard/results', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-results-live="1"]')).toBeVisible({ timeout: 30_000 });
    const account = await page.locator('[data-header-account]').boundingBox();
    expect(account).toBeTruthy();
    expect((account?.x ?? 0) + (account?.width ?? 0)).toBeLessThanOrEqual(1280);
    expect(account?.x ?? 0).toBeGreaterThanOrEqual(0);
    const sidebarText = await page.locator('aside').innerText();
    expect(sidebarText).not.toMatch(/\bnav\./);
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
    const desk = page.locator('[data-results-desk="1"]');
    await desk.getByRole('button', { name: 'Record a result' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Level');
    await desk.getByRole('button', { name: 'IGCSE / O-Level' }).click();
    const cyan = await page.locator('[data-result-level="IGCSE"]').evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(cyan).toBe('rgb(63, 224, 208)');
    const disclaimer = await page.locator('[data-results-disclaimer]').evaluate((node) => getComputedStyle(node).color);
    expect(disclaimer).toBe('rgb(30, 106, 131)');
    await page.screenshot({ path: `${SHOTS}/entry-desktop-light.png` });
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Subject');
    await desk.locator('#result-subject').fill(subject);
    await desk.locator('#result-board').selectOption('Cambridge International');
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Grade');
    await desk.locator('#result-grade').fill('A*');
    await desk.locator('#result-session').fill(session);
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[data-flow-trail] [aria-current="step"]')).toHaveText('Certificate');
    await desk.locator('#result-file').setInputFiles({
      name: 'certificate.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    });
    await page.locator('[data-flow-nav]').getByRole('button', { name: 'Save result' }).click();
    const row = desk.locator(`[data-result-subject="${subject}"]`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute('data-result-status', 'self-reported');
    await expect(row.getByText('Self-reported')).toBeVisible();
    await expect(row.getByText('Verified by the school')).toHaveCount(0);
    await expect(desk.locator(`[data-results-progress="${session}"]`)).toBeVisible();
    await expect(page.getByText(/Poket School awards/i)).toHaveCount(0);
    const overflow = await page.locator('[data-results-panel]').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `${SHOTS}/desk-desktop-light.png` });
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SHOTS}/desk-desktop-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/desk-mobile-dark.png` });
    await setTheme(page, 'light');
    const mobileOverflow = await page.locator('[data-results-panel]').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(mobileOverflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `${SHOTS}/desk-mobile-light.png` });

    await page.setViewportSize({ width: 1280, height: 900 });
    const shareBox = page.locator('[data-results-share]');
    await expect(shareBox).toBeVisible();
    if (await shareBox.getAttribute('data-results-share') === 'on') {
      await desk.getByRole('button', { name: 'Turn sharing off' }).click();
      await expect(page.locator('[data-results-share="off"]')).toBeVisible();
    }
    await desk.getByRole('button', { name: 'Turn sharing on' }).click();
    await expect(page.locator('[data-results-share="on"]')).toBeVisible();
    const href = await page.locator('[data-results-link]').getAttribute('href');
    expect(href).toMatch(/^\/results\/[a-f0-9]+$/);
    const resultId = await row.getAttribute('data-result-id');
    expect(resultId).toBeTruthy();
    const file = await page.request.get(`/api/results/file?id=${resultId}`, { headers: { Authorization: `Bearer ${studentToken}` } });
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('image/png');
    expect(file.headers()['content-disposition']).toContain('attachment');
    const anonymousFile = await page.request.get(`/api/results/file?id=${resultId}`);
    expect([401, 503]).toContain(anonymousFile.status());
    const studentVerify = await page.request.post('/api/results', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { action: 'verify', id: resultId },
    });
    expect(studentVerify.status()).toBe(403);
    const schoolReal = await page.request.post('/api/results', {
      headers: { Authorization: `Bearer ${schoolToken}` },
      data: { action: 'verify', id: resultId },
    });
    expect(schoolReal.status()).toBe(403);

    await page.goto(href || '/results/not-a-real-token', { waitUntil: 'domcontentloaded' });
    const published = page.locator('[data-results-public="open"]');
    await expect(published).toBeVisible();
    await expect(published.getByText(subject, { exact: true })).toBeVisible();
    await expect(published.getByText(DISCLAIMER)).toBeVisible();
    await expect(published.getByText('certificate.png')).toHaveCount(0);
    await expect(published.getByRole('button', { name: 'Open certificate' })).toHaveCount(0);
    await expect(page.getByText(/Poket School awards/i)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/public-desktop-light.png` });
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${SHOTS}/public-desktop-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, 'light');
    const publicOverflow = await published.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(publicOverflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `${SHOTS}/public-mobile-light.png` });

    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, STUDENT);
    await page.goto('/dashboard/results', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-results-live="1"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-results-desk="1"]').getByRole('button', { name: 'Turn sharing off' }).click();
    await expect(page.locator('[data-results-share="off"]')).toBeVisible();
    await page.goto(href || '/results/not-a-real-token', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-results-public="private"]')).toBeVisible();
    await expect(page.getByText(subject)).toHaveCount(0);
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/private-desktop-light.png` });

    await signIn(page, PARENT);
    await page.goto(`/dashboard/results?student=${studentId}`, { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-results-live="1"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-results-role="parent"]')).toBeVisible();
    await expect(page.locator(`[data-result-subject="${subject}"]`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record a result' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(0);
    const parentFile = await page.request.get(`/api/results/file?id=${resultId}`, { headers: { Authorization: `Bearer ${await idToken(PARENT)}` } });
    expect(parentFile.status()).toBe(200);
    await page.screenshot({ path: `${SHOTS}/parent-desktop-light.png` });

    await signIn(page, ADMIN);
    await page.goto(`/dashboard/results?student=${studentId}`, { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-results-live="1"]')).toBeVisible({ timeout: 30_000 });
    const adminRow = page.locator(`[data-result-subject="${subject}"]`);
    await expect(adminRow).toBeVisible();
    await adminRow.getByRole('button', { name: 'Verify' }).click();
    await expect(adminRow).toHaveAttribute('data-result-status', 'verified');
    await expect(adminRow.getByText('Verified by the school')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/verified-desktop-light.png` });
  });
});
