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

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function phoneDockFits(page: Page) {
  const view = page.viewportSize();
  if (!view || view.width >= 1024) return;
  const more = page.getByRole('button', { name: 'More' });
  const et = page.getByRole('button', { name: 'Open ET AI' });
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(more).toBeVisible();
  await expect(et).toBeVisible();
  await expect(nav).toBeVisible();
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="Open ET AI"]');
    if (!(button instanceof HTMLElement)) return false;
    const box = button.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44;
  });
  const moreBox = await more.boundingBox();
  const etBox = await et.boundingBox();
  const navBox = await nav.boundingBox();
  expect(moreBox && etBox && navBox).toBeTruthy();
  expect(intersects(moreBox!, etBox!)).toBe(false);
  expect(etBox!.y + etBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
  expect(etBox!.width).toBeGreaterThanOrEqual(44);
  expect(etBox!.height).toBeGreaterThanOrEqual(44);

  const actions = page.locator('[data-lesson-actions]');
  const actionBox = await actions.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(intersects(etBox!, actionBox!)).toBe(false);
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

  const flow = page.locator('[data-quiz-flow] [data-flow-nav]');
  if (!(await flow.isVisible().catch(() => false))) return;
  const back = flow.getByRole('button', { name: 'Back' });
  const next = flow.getByRole('button', { name: /Next|See score/ });
  for (const control of [back, next]) {
    await expect(control).toBeVisible();
    const item = await control.boundingBox();
    expect(item).not.toBeNull();
    expect(item!.width).toBeGreaterThanOrEqual(44);
    expect(item!.height).toBeGreaterThanOrEqual(44);
    expect(item!.x).toBeGreaterThanOrEqual(-1);
    expect(item!.y).toBeGreaterThanOrEqual(-1);
    expect(item!.x + item!.width).toBeLessThanOrEqual(view.width + 1);
    expect(item!.y + item!.height).toBeLessThanOrEqual(navBox!.y + 1);
    expect(intersects(item!, actionBox!)).toBe(false);
    expect(intersects(item!, etBox!)).toBe(false);
    expect(intersects(item!, moreBox!)).toBe(false);
    expect(intersects(item!, navBox!)).toBe(false);
  }
}

async function lessonFits(page: Page) {
  const heading = page.getByRole('heading', { level: 1 }).first();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(8);
  const sidebar = page.locator('[data-tour="sidebar"]');
  if (await sidebar.isVisible().catch(() => false)) {
    const side = await sidebar.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual((side?.x ?? 0) + (side?.width ?? 0) - 1);
  }
  const note = page.getByRole('button', { name: 'Add note' });
  await note.scrollIntoViewIfNeeded();
  const noteBox = await note.boundingBox();
  expect(noteBox).not.toBeNull();
  const view = page.viewportSize();
  if (view && view.width < 1024) {
    const actions = page.locator('[data-lesson-actions]');
    await expect(actions).toBeVisible();
    const controls = [
      page.getByRole('button', { name: /Bookmark|Saved/ }).first(),
      page.getByRole('button', { name: /Mark Complete|Completed|Saving/ }).first(),
      page.getByRole('link', { name: 'Continue lesson' }).first(),
      note,
    ];
    const boxes = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const item = await control.boundingBox();
      expect(item).not.toBeNull();
      expect(item!.x).toBeGreaterThanOrEqual(-1);
      expect(item!.y).toBeGreaterThanOrEqual(-1);
      expect(item!.x + item!.width).toBeLessThanOrEqual(view.width + 1);
      expect(item!.y + item!.height).toBeLessThanOrEqual(view.height - 60);
      boxes.push(item!);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(intersects(boxes[i], boxes[j])).toBe(false);
      }
    }
    await phoneDockFits(page);
    return;
  }
  for (const name of [/Bookmark|Saved/, /Mark Complete|Completed|Saving/]) {
    const control = page.getByRole('button', { name }).first();
    if (!(await control.isVisible().catch(() => false))) continue;
    const other = await control.boundingBox();
    if (!other || !noteBox) continue;
    expect(intersects(noteBox, other)).toBe(false);
  }
}

async function narrowLesson(page: Page) {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await closeSidebar(page);
    await lessonFits(page);
  }
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
    await narrowLesson(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'lesson-390-dark');
    await theme(page, 'light');
    await narrowLesson(page);
    await page.setViewportSize({ width: 390, height: 844 });
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
    await narrowLesson(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, 'quiz-390-dark');
    await theme(page, 'light');
    await narrowLesson(page);
    await page.setViewportSize({ width: 390, height: 844 });
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
