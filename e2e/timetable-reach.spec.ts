import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';
import { TIMETABLE_COPY } from '../lib/timetable/copy';
import { GOOGLE_CALENDAR_COPY } from '../lib/google-calendar/copy';

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

async function signIn(page: Page, email: string, home: string) {
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
  await page.evaluate(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true,
      functional: true,
      analytics: false,
      aiPerformance: false,
      decidedAt: '2026-10-19T00:00:00.000Z',
    }));
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  const homePattern = new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`);
  const opened = await page.waitForURL(homePattern, { timeout: 8_000 }).then(() => true).catch(() => false);
  if (!opened) await page.goto(home, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(homePattern, { timeout: 30_000 });
  await dismissCookies(page);
}

test.describe('timetabler on the signed-in emulator', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to open the timetabler from the dashboards.');
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const db = adminDb();
    const people = [
      {
        email: 'student.e2e@poketschool.ai',
        profile: { role: 'student', name: 'E2E Learner', emailVerified: false, twoFactorEnabled: false },
      },
      {
        email: 'teacher.e2e@poketschool.ai',
        profile: { role: 'teacher', name: 'E2E Teacher', permissions: ['addon:et_ai_timetabler'], emailVerified: false, twoFactorEnabled: false },
      },
      {
        email: 'institution.e2e@poketschool.ai',
        profile: {
          role: 'institution_admin',
          name: 'E2E Institution',
          institutionId: 'e2e-school',
          permissions: ['addon:et_ai_timetabler', 'package:enterprise'],
          emailVerified: false,
          twoFactorEnabled: false,
        },
      },
    ];
    for (const person of people) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: false });
      }
      await db.collection('users').doc(user.uid).set({ ...person.profile, email: person.email }, { merge: true });
    }
    await db.collection('institutions').doc('e2e-school').set({
      name: 'E2E Academy',
      status: 'active',
      setupComplete: true,
      billingPhase: 'active',
    }, { merge: true });
  });

  test('institution admin builds a week, fixes a clash, and sees cover', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page, 'institution.e2e@poketschool.ai', '/dashboard/institution');
    await expect(page.getByRole('button', { name: 'ET AI Timetabler' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'ET AI Timetabler' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/institution\/timetable/);
    await dismissCookies(page);
    await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-timetable="institution"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-edition="enterprise"]')).toBeVisible();
    await expect(page.locator('[data-google-state="unconfigured"]')).toBeVisible();
    await expect(page.locator('[data-google-unconfigured="1"]')).toHaveText(GOOGLE_CALENDAR_COPY.notConfigured);
    await expect(page.locator('[data-google-error="1"]')).toContainText(GOOGLE_CALENDAR_COPY.noError);
    await expect(page.locator('[data-timetable-ready="1"]')).toBeVisible();
    await page.locator('[data-action="generate"]').click();
    await expect(page.locator('[data-timetable]')).toHaveAttribute('data-generated', /^[1-9]/);
    await expect(page.locator('[data-lesson]').first()).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/timetable-built.png', fullPage: false });
    const first = page.locator('[data-lesson]').first();
    await first.click();
    const teacher = await first.getAttribute('data-teacher');
    const slot = await first.getAttribute('data-slot');
    await page.locator(`[data-lesson][data-teacher="${teacher}"]:not([data-slot="${slot}"])`).first().click();
    await expect(page.locator('[data-blocked="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/timetable-clash.png', fullPage: false });
    await page.locator('[data-action="fix"]').click();
    await expect(page.locator('[data-blocked="1"]')).toHaveCount(0);
    await page.locator('[data-tab="cover"]').click();
    await page.locator('[data-cover="1"] select').nth(1).selectOption('absent');
    for (const date of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) {
      await page.locator('[data-cover="1"] input').fill(date);
      await page.locator('[data-action="propose-cover"]').click();
      const count = await page.locator('[data-proposals]').getAttribute('data-proposals');
      if (count && count !== '0') break;
    }
    await expect(page.locator('[data-proposals]')).not.toHaveAttribute('data-proposals', '0');
    await page.locator('[data-cover="1"]').screenshot({ path: '/opt/cursor/artifacts/screenshots/timetable-cover.png' });
    const download = page.waitForEvent('download');
    await page.locator('[data-tab="publish"]').click();
    await page.locator('[data-action="ical"]').click();
    expect((await download).suggestedFilename()).toContain('.ics');
    await page.locator('[data-action="google-regenerate"]').click();
    const feed = page.locator('[data-feed-url="1"]');
    await expect(feed).toBeVisible({ timeout: 20_000 });
    const url = (await feed.innerText()).trim();
    const response = await page.request.get(url);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('BEGIN:VCALENDAR');
    expect(errors).toEqual([]);
  });

  test('teacher opens the timetabler from the dashboard and from AI Studio', async ({ page }) => {
    await signIn(page, 'teacher.e2e@poketschool.ai', '/dashboard/teacher');
    await expect(page.getByRole('button', { name: 'ET AI Timetabler' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'ET AI Timetabler' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/teacher\/timetable/);
    await dismissCookies(page);
    await expect(page.locator('[data-timetable="teacher"]')).toBeVisible({ timeout: 30_000 });
    await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-studio-home="chat"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('textbox', { name: 'Message ET AI' })).toBeVisible();
    const entry = page.locator('[data-studio-entry="timetable"]');
    await expect(entry).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'AI Studio' }).getByRole('link', { name: 'Timetabler' })).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/timetable-studio-entry.png', fullPage: false });
    await entry.click();
    await expect(page).toHaveURL(/\/dashboard\/studio\/timetable/);
    await expect(page.locator('[data-studio-timetable="1"]')).toBeVisible();
    await expect(page.locator('[data-studio-shell="standalone"]')).toHaveCount(0);
  });

  test('a student does not see the studio timetabler entry', async ({ page }) => {
    await signIn(page, 'student.e2e@poketschool.ai', '/dashboard/student');
    await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-studio-home="chat"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-studio-entry="timetable"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'AI Studio' }).getByRole('link', { name: 'Timetabler' })).toHaveCount(0);
  });
});
