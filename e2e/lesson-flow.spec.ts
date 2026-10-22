import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FLOW_COURSE, FLOW_LESSONS, seedLessonFlow } from './fixtures/lesson-flow';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const SHOTS = '/opt/cursor/artifacts/screenshots/lesson-arrows';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.getByRole('button', { name: /Accept all|Terima semua/ }).click().catch(() => undefined);
    await dialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
  }
}

async function signIn(page: Page) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.e2e@poketschool.ai', password: PASSWORD, returnSecureToken: true }),
  });
  const data = await response.json() as { localId?: string; idToken?: string; refreshToken?: string; error?: { message?: string } };
  if (!data.localId || !data.idToken || !data.refreshToken) {
    throw new Error(data.error?.message || 'Emulator sign-in failed');
  }
  const now = Date.now();
  const user = {
    uid: data.localId,
    email: 'student.e2e@poketschool.ai',
    emailVerified: false,
    isAnonymous: false,
    providerData: [{ providerId: 'password', uid: 'student.e2e@poketschool.ai', email: 'student.e2e@poketschool.ai', displayName: null }],
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
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('pocket-school-lang', 'en');
    localStorage.setItem('pocket-school-lang-source', 'user');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
    document.cookie = 'poket-lang=en; Path=/; SameSite=Lax';
  }, { storageKey, user });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Account menu' }).first()).toBeVisible({ timeout: 60_000 });
  await dismissCookies(page);
}

async function theme(page: Page, mode: 'light' | 'dark') {
  await page.evaluate((next) => {
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, mode);
}

async function closeSidebar(page: Page) {
  await page.evaluate(() => {
    const button = document.querySelector('header button[aria-expanded="true"]');
    if (button instanceof HTMLElement) button.click();
  });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

test.describe('lesson and quiz arrows', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to open the sample lesson.');

  test.beforeAll(async () => {
    if (!LIVE) return;
    await seedLessonFlow(PASSWORD);
  });

  test('FlowTrail and FlowNav move between lessons and questions', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await theme(page, 'light');
    await page.goto(`/dashboard/student/courses/${FLOW_COURSE}/lessons/${FLOW_LESSONS.plant}`, { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Plant cells' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Cell story')).toBeVisible();
    await expect(page.getByText('Cell chant')).toBeVisible();
    await expect(page.getByText('Plant cell parts')).toBeVisible();
    const lessonTrail = page.locator('[data-lesson-flow] [data-flow-trail]');
    await expect(lessonTrail.locator('[data-flow-step="e2e-flow-plant"]')).toHaveAttribute('aria-current', 'step');
    await shot(page, 'lesson-desktop-light');

    await page.locator('[data-lesson-flow] [data-flow-nav]').getByRole('link', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Animal cells' })).toBeVisible({ timeout: 30_000 });
    await lessonTrail.locator('[data-flow-step="e2e-flow-plant"]').click();
    await expect(page.getByRole('heading', { name: 'Plant cells' })).toBeVisible({ timeout: 30_000 });

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Animal cells' })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Comparing cells' })).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-lesson-flow] [data-flow-nav]').getByRole('link', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Animal cells' })).toBeVisible({ timeout: 30_000 });
    await theme(page, 'dark');
    await shot(page, 'lesson-desktop-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await closeSidebar(page);
    await shot(page, 'lesson-390-dark');
    await theme(page, 'light');
    await shot(page, 'lesson-390-light');
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('tab', { name: 'Quiz' }).click();
    const quiz = page.locator('[data-quiz-flow]');
    await expect(quiz.locator('[data-quiz-question="0"]')).toContainText('Which part holds the genetic material?');
    await expect(quiz.locator('[data-quiz-question="1"]')).toHaveCount(0);
    await quiz.locator('[data-flow-step="2"]').click();
    await expect(quiz.locator('[data-quiz-question="2"]')).toContainText('What is the smallest living unit?');
    await quiz.locator('[data-flow-nav]').getByRole('button', { name: 'Back' }).click();
    await expect(quiz.locator('[data-quiz-question="1"]')).toContainText('Which cells have a cell wall?');
    await page.keyboard.press('ArrowLeft');
    await expect(quiz.locator('[data-quiz-question="0"]')).toContainText('Which part holds the genetic material?');
    await expect(page.getByRole('heading', { name: 'Animal cells' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(quiz.locator('[data-quiz-question="1"]')).toContainText('Which cells have a cell wall?');
    await quiz.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).click();
    await expect(quiz.locator('[data-quiz-question="2"]')).toContainText('What is the smallest living unit?');
    await shot(page, 'quiz-desktop-light');

    await theme(page, 'dark');
    await shot(page, 'quiz-desktop-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await closeSidebar(page);
    await shot(page, 'quiz-390-dark');
    await theme(page, 'light');
    await shot(page, 'quiz-390-light');

    await quiz.locator('[data-flow-step="0"]').click();
    await page.keyboard.press('ArrowLeft');
    await expect(quiz.locator('[data-quiz-question="0"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Animal cells' })).toBeVisible();
    const nextBox = await quiz.locator('[data-flow-nav]').getByRole('button', { name: 'Next' }).boundingBox();
    expect(nextBox).not.toBeNull();
    expect((nextBox?.x ?? 0) + (nextBox?.width ?? 0)).toBeLessThanOrEqual(390);
  });
});
