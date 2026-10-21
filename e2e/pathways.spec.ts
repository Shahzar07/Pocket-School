import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

test.setTimeout(180_000);
import { HOME } from '../lib/marketing/home';
import { pathwayBySlug } from '../lib/pathways/catalog';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Accept all' }).click();
  }
}

async function openCard(page: Page, title: string, href: string) {
  await page.goto('/');
  await dismissCookies(page);
  const section = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Primary through degree foundation.' }),
  });
  const card = section.getByRole('link').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
}

for (const card of HOME.levels) {
  test(`${card.title} card opens stages and subjects`, async ({ page }) => {
    await openCard(page, card.title, card.href);
    const pathway = pathwayBySlug(card.href.replace(/^\//, ''));
    expect(pathway).toBeTruthy();
    await expect(page.locator('[data-pathway]')).toHaveAttribute('data-pathway', pathway!.slug);
    await expect(page.getByRole('navigation', { name: 'Stages' })).toBeVisible();
    await expect(page.locator('[data-pathway-stage]').first()).toBeVisible();
    const subject = pathway!.stages[0]?.subjects[0]?.name ?? '';
    await expect(page.locator('[data-pathway-subject]').filter({ hasText: subject }).first()).toBeVisible();
    await expect(page.locator('[data-pathway-price]')).toHaveAttribute('data-pathway-price', card.price);
    const stageLink = page.locator('[data-stage-nav] a').first();
    const hash = await stageLink.getAttribute('href');
    await stageLink.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.locator(hash ?? 'h1')).toBeVisible();
    const jsonLd = await page.locator('script[data-faq-jsonld="1"]').evaluate((node) => node.textContent ?? '');
    expect(jsonLd).toContain('FAQPage');
    await expect(page.getByRole('link', { name: 'Talk to us' })).toBeVisible();
  });
}

test('LLB page lists years, Contract Law, and ET Law', async ({ page }) => {
  await page.goto('/llb');
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'Year 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year 3' })).toBeVisible();
  await expect(page.getByText('Contract Law').first()).toBeVisible();
  await expect(page.getByText('Legal System and Method').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'ET Law' }).first()).toBeVisible();
  await expect(page.locator('[data-pathway-disclaimer="1"]')).toHaveText('Degree pathway. Not a university enrolment.');
  await page.screenshot({ path: 'docs/qa/pathways/pathway-llb.png', fullPage: true });
  // The public header overflows at this width, so the theme control is off-screen.
  await page.getByRole('button', { name: 'Switch to dark mode' }).evaluate((node: HTMLButtonElement) => node.click());
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: 'docs/qa/pathways/pathway-llb-dark.png', fullPage: true });
});

test('IGCSE page lists subjects and boards', async ({ page }) => {
  await page.goto('/igcse');
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'IGCSE', exact: true }).first()).toBeVisible();
  await expect(page.getByText('English First Language').first()).toBeVisible();
  await expect(page.getByText('Mathematics').first()).toBeVisible();
  await expect(page.getByText('Biology').first()).toBeVisible();
  await expect(page.getByText('Pearson Edexcel').first()).toBeVisible();
  await expect(page.getByText('Poket School does not award those grades.').first()).toBeVisible();
  await expect(page.locator('[data-flow-trail]')).toBeVisible();
  await expect(page.locator('[data-flow-nav] a').last()).toHaveAttribute('href', '/alevel');
  await page.screenshot({ path: 'docs/qa/pathways/pathway-igcse.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/qa/pathways/pathway-igcse-mobile.png', fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: 'docs/qa/pathways/pathway-igcse-mobile-dark.png', fullPage: true });
});

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
}

test('admin pathway desk hides the studio shell', async ({ page }) => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to open the pathway desk against the emulator.');
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
  await adminDb().collection('users').doc(user.uid).set({
    role: 'admin',
    adminRole: 'super_admin',
    name: 'E2E Admin',
    email,
    emailVerified: false,
    twoFactorEnabled: false,
  }, { merge: true });
  await page.addInitScript(() => {
    window.localStorage.setItem('poket-pip-onboarded', '1');
  });
  await signIn(page, email);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dashboard/admin/pathways', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.locator('[data-pathway-desk="1"]')).toBeVisible();
  await expect(page.locator('[data-pathway-editor="1"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pathways' })).toBeVisible();
  await expect(page.locator('[data-studio-immersive="1"]')).toHaveCount(0);
  await expect(page.locator('[data-tool-shell="1"]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'AI Studio' })).toHaveCount(0);
  await page.screenshot({ path: 'docs/qa/pathways/pathway-editor-light.png', fullPage: false });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: 'docs/qa/pathways/pathway-editor-dark.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/qa/pathways/pathway-editor-mobile.png', fullPage: false });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: 'docs/qa/pathways/pathway-editor-mobile-dark.png', fullPage: false });
});
