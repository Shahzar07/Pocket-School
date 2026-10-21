import { expect, test, type Page } from '@playwright/test';
import { markEssayAtLevel } from '../lib/essay/mark-level';
import {
  DEGREE_PROMPT,
  DEGREE_SAMPLE,
  IGCSE_PROMPT,
  IGCSE_SAMPLE,
  MASTERS_PROMPT,
  MASTERS_SAMPLE,
  PHD_PROMPT,
  PHD_SAMPLE,
} from '../lib/essay/samples';
import { countWords, mapEssayScale } from '../lib/essay/scale-config';

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

async function signIn(page: Page) {
  const email = 'teacher.e2e@poketschool.ai';
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
    localStorage.setItem('theme', 'light');
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true,
      functional: true,
      analytics: false,
      aiPerformance: false,
      decidedAt: '2026-10-19T00:00:00.000Z',
    }));
  });
}

async function setTheme(page: Page, mode: 'light' | 'dark') {
  const html = page.locator('html');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const cls = (await html.getAttribute('class')) ?? '';
    const isDark = cls.split(/\s+/).includes('dark');
    if ((mode === 'dark') === isDark) return;
    await page.getByRole('button', { name: isDark ? 'Switch to light mode' : 'Switch to dark mode' }).click();
    await expect(html).toHaveClass(new RegExp(`\\b${mode}\\b`));
  }
}

test('ET AI Essay Writer marks IGCSE, degree, masters, and PhD', async ({ page }) => {
  test.skip(!LIVE, 'needs the Firebase emulator');
  test.setTimeout(360_000);
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard/studio/essay', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'Write, then let ET AI mark it' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('ET AI marks the essay against the level you choose.')).toBeVisible();
  await setTheme(page, 'light');

  const cases = [
    {
      id: 'igcse',
      type: 'argumentative',
      subject: 'English',
      board: 'Cambridge',
      words: countWords(IGCSE_SAMPLE),
      prompt: IGCSE_PROMPT,
      essay: IGCSE_SAMPLE,
      referencing: '',
      blurb: '9 to 1, a percentage, and A* to U.',
      criterion: 'SPaG',
    },
    {
      id: 'degree',
      type: 'research-essay',
      subject: 'English',
      board: 'Faculty of Arts',
      words: countWords(DEGREE_SAMPLE),
      prompt: DEGREE_PROMPT,
      essay: DEGREE_SAMPLE,
      referencing: 'harvard',
      blurb: 'UK classification',
      criterion: 'Argument and thesis',
    },
    {
      id: 'masters',
      type: 'literature-review',
      subject: 'English',
      board: '',
      words: countWords(MASTERS_SAMPLE),
      prompt: MASTERS_PROMPT,
      essay: MASTERS_SAMPLE,
      referencing: 'apa',
      blurb: 'Distinction, merit, pass, or fail',
      criterion: 'Methodology',
    },
    {
      id: 'phd',
      type: 'dissertation',
      subject: 'English',
      board: '',
      words: 900,
      prompt: PHD_PROMPT,
      essay: PHD_SAMPLE,
      referencing: 'chicago',
      blurb: 'No grade.',
      criterion: 'Research question clarity',
    },
  ] as const;

  for (const item of cases) {
    const expected = markEssayAtLevel({
      essay: item.essay,
      prompt: item.prompt,
      levelId: item.id,
      writingType: item.type,
      subject: item.subject,
      board: item.board,
      wordTarget: item.words,
      referencing: item.referencing,
      degreeStyle: 'uk',
    });
    const setup = page.locator('[data-essay-setup="1"]');
    await page.setViewportSize({ width: 1280, height: 900 });
    await setTheme(page, 'light');
    const levelId = item.id === 'degree' ? 'undergraduate' : item.id;
    await setup.getByLabel('Level', { exact: true }).click();
    await setup.locator(`[data-level-id="${levelId}"]`).click();
    await expect(setup.locator(`select[data-essay-type] option[value="${item.type}"]`)).toHaveCount(1);
    await setup.getByLabel('Writing type', { exact: true }).selectOption(item.type);
    await setup.getByLabel('Subject (optional)').fill(item.subject);
    await setup.getByLabel('Exam board or institution style (optional)').fill(item.board);
    await setup.getByLabel('Target word count').fill(String(item.words));
    if (item.referencing) await setup.getByLabel('Referencing style').selectOption(item.referencing);
    if (item.id === 'degree') await setup.getByRole('button', { name: 'UK classification', exact: true }).click();
    await expect(page.locator('[data-essay-blurb]')).toContainText(item.blurb);
    await page.getByLabel('Essay task').fill(item.prompt);
    await page.getByLabel('Essay', { exact: true }).fill(item.essay);
    await expect(page.locator('[data-essay-words]')).toHaveText(`${countWords(item.essay)} / ${item.words} words`);
    await page.screenshot({ path: `docs/qa/essays/essay-${item.id}-setup-light-desktop.png` });
    await page.getByRole('button', { name: 'Mark against this level' }).click();
    await expect(page.locator('[data-essay-headline]')).toHaveText(expected.headline, { timeout: 30_000 });
    await expect(page.locator('[data-essay-estimate]')).toHaveText('ET AI estimate, not an official grade');
    await expect(page.getByRole('heading', { name: item.criterion, exact: true })).toBeVisible();
    if (expected.showsPercentage) {
      await expect(page.locator('[data-essay-percent]')).toHaveText(`${expected.percentage}%`);
    } else {
      await expect(page.locator('[data-essay-percent]')).toHaveCount(0);
    }

    const shoot = async (name: string) => {
      const result = page.locator('[data-essay-result]');
      await result.evaluate((node) => node.scrollIntoView({ block: 'start', inline: 'nearest' }));
      await expect(page.locator('[data-essay-headline]')).toBeInViewport();
      await page.screenshot({ path: `docs/qa/essays/essay-${name}.png` });
      await result.screenshot({ path: `docs/qa/essays/essay-${name}-result.png` });
    };
    await shoot(`${item.id}-light-desktop`);
    await setTheme(page, 'dark');
    await shoot(`${item.id}-dark-desktop`);
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await shoot(`${item.id}-light-mobile`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await setTheme(page, 'dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await shoot(`${item.id}-dark-mobile`);
    await page.setViewportSize({ width: 1280, height: 900 });

    if (item.id === 'degree' && expected.percentage != null) {
      await setTheme(page, 'light');
      const cgpa = mapEssayScale('degree', expected.percentage, { degreeStyle: 'cgpa' });
      await setup.getByRole('button', { name: 'Malaysian CGPA-style', exact: true }).click();
      await expect(page.locator('[data-essay-headline]')).toHaveText(cgpa.headline);
      await expect(page.locator('[data-essay-result]')).toContainText('not a university transcript');
      await expect(page.locator('[data-essay-percent]')).toHaveText(`${expected.percentage}%`);
      await shoot('degree-cgpa-light-desktop');
      await setTheme(page, 'dark');
      await shoot('degree-cgpa-dark-desktop');
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await setTheme(page, 'light');
  await page.goto('/dashboard/teacher/assignments', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New Assignment' }).click();
  await page.getByRole('checkbox', { name: 'ET AI Essay Writer task. ET AI marks it against the chosen level.' }).check();
  await page.getByLabel('Level', { exact: true }).click();
  await page.locator('[data-level-id="phd"]').click();
  await page.getByLabel('Writing type', { exact: true }).selectOption('dissertation');
  await page.getByLabel('Rubric (optional)').fill('Thesis clarity\nSources');
  await expect(page.getByText('The level, writing type, and rubric are saved with this task.')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Narrative' })).toHaveCount(0);
  await page.screenshot({ path: 'docs/qa/essays/essay-assign-light-desktop.png', fullPage: true });
});
