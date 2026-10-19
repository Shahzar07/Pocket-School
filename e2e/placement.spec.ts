import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const ADMIN = 'harry@poketschool.ai';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.getByRole('button', { name: 'Accept all' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
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
}

test.describe('featured placement', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to run placement against the preview.');
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const db = adminDb();
    let user;
    try {
      user = await auth.getUserByEmail(ADMIN);
      await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
    } catch {
      user = await auth.createUser({ email: ADMIN, password: PASSWORD, emailVerified: false, displayName: 'Harry Seggu' });
    }
    await db.collection('users').doc(user.uid).set({
      role: 'admin',
      adminRole: 'super_admin',
      name: 'Harry Seggu',
      email: ADMIN,
      emailVerified: false,
      twoFactorEnabled: false,
    }, { merge: true });
    const placement = (priority: number, extra: Record<string, unknown> = {}) => ({
      marketplace: 'approved',
      featured: true,
      core: true,
      levels: ['igcse_alevel'],
      institutionIds: ['e2e-rochford'],
      priority,
      featuredFrom: '',
      featuredUntil: '',
      ...extra,
    });
    await db.collection('courses').doc('e2e-featured-physics').set({
      title: 'Physics — IGCSE',
      description: 'Forces and motion for the featured carousel.',
      ownerId: user.uid,
      ownerName: 'E2E Teacher',
      status: 'published',
      isPublic: true,
      type: 'course',
      subject: 'Physics',
      level: 'IGCSE',
      price: 79,
      currency: 'USD',
      marketplaceApproved: true,
      featured: true,
      placement: placement(40),
      ratingAverage: 4.8,
      ratingCount: 3,
    });
    await db.collection('courses').doc('e2e-featured-bundle').set({
      title: 'Science pack',
      description: 'A featured bundle.',
      ownerId: user.uid,
      ownerName: 'E2E Teacher',
      status: 'published',
      isPublic: true,
      type: 'bundle',
      subject: 'Science',
      level: 'IGCSE',
      price: 19,
      currency: 'USD',
      marketplaceApproved: true,
      featured: true,
      placement: placement(10, { core: false, levels: [] }),
    });
    await db.collection('courses').doc('e2e-year-title').set({
      title: 'Physics — Year 11',
      description: 'A title that still uses a year number.',
      ownerId: user.uid,
      ownerName: 'Ada Lovelace',
      institutionId: 'e2e-rochford',
      status: 'draft',
      isPublic: false,
      type: 'course',
      subject: 'Physics',
      level: 'IGCSE',
      price: 79,
      currency: 'USD',
      placement: { marketplace: 'hidden', featured: false, core: false, levels: [], institutionIds: [] },
    });
    await db.collection('courses').doc('e2e-bio-1').set({
      title: 'Biology 101',
      description: 'First biology record.',
      ownerId: user.uid,
      ownerName: 'Ada Lovelace',
      status: 'draft',
      isPublic: false,
      type: 'course',
      placement: { marketplace: 'hidden', featured: false, core: false, levels: [], institutionIds: [] },
    });
    await db.collection('courses').doc('e2e-bio-2').set({
      title: 'Biology 101',
      description: 'Second biology record.',
      ownerId: 'other-owner',
      ownerName: 'Grace Hopper',
      status: 'published',
      isPublic: false,
      type: 'course',
      placement: { marketplace: 'hidden', featured: false, core: false, levels: [], institutionIds: [] },
    });
    const createdAt = new Date('2026-10-01T00:00:00Z');
    await db.collection('institutions').doc('e2e-rochford').set({
      name: "Rochford's International School",
      domain: 'rochford.example',
      status: 'active',
      studentCount: 1,
      teacherCount: 1,
      createdAt,
    }, { merge: true });
    await db.collection('institutions').doc('e2e-rochford-copy').set({
      name: "Rochford's International School",
      domain: 'rochford.example',
      status: 'active',
      studentCount: 1,
      teacherCount: 1,
      createdAt: new Date('2026-10-02T00:00:00Z'),
    }, { merge: true });
    await db.collection('books').doc('e2e-harbour').set({
      id: 'e2e-harbour',
      title: 'Harbour Notes',
      author: 'ET AI',
      status: 'published',
      allocateMarketplace: true,
      allocateLibrary: true,
      priceUsd: 4.99,
      readingLevel: 'igcse',
      ownerId: user.uid,
      showcase: { featured: true, priority: 10, from: '', until: '' },
    }, { merge: true });
  });

  test('marketplace hero rotates featured courses and the placement page previews them', async ({ page }) => {
    await page.goto('/courses', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    const hero = page.locator('[data-featured-carousel="hero"]');
    await expect(hero).toBeVisible({ timeout: 60_000 });
    await expect(hero).toHaveAttribute('data-slide', 'e2e-featured-physics');
    await expect(hero.getByRole('link', { name: 'Physics — IGCSE' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Buy' })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Enrol' })).toBeVisible();
    await expect(hero.getByText('4.8 · 3')).toBeVisible();
    await expect(hero.getByText('$79')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/featured-marketplace-hero.png', fullPage: false });
    await hero.focus();
    await page.keyboard.press('ArrowRight');
    await expect(hero).not.toHaveAttribute('data-slide', 'e2e-featured-physics');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-featured-carousel="hero"]')).toHaveAttribute('data-motion', 'reduce');

    await signIn(page, ADMIN);
    await page.goto('/dashboard/admin/placement', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Course placement' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Physics — Year 11/ }).click();
    await expect(page.getByText('Suggested title: Physics — IGCSE')).toBeVisible();
    await expect(page.getByText('This course is not public.')).toBeVisible();
    await expect(page.getByText('Approve the marketplace listing before a featured spot.')).toBeVisible();
    const featuredBox = page.getByRole('checkbox', { name: 'Featured spot' });
    await expect(featuredBox).toBeDisabled();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/placement-year-hint.png', fullPage: true });

    await page.getByRole('button', { name: /E2E Teacher/ }).filter({ hasText: 'Physics — IGCSE' }).click();
    await expect(page.locator('[data-featured-carousel="preview"]')).toBeVisible();
    await expect(page.getByText('Your programme').first()).toBeVisible();
    await expect(page.getByText("Rochford's International School").first()).toBeVisible();
    await expect(page.getByText('Duplicate institution record.')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/placement-live-previews.png', fullPage: true });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    const row = page.locator('[data-featured-carousel="row"]');
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/featured-landing-row.png', fullPage: false });

    await page.goto('/dashboard/marketplace', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-featured-carousel="hero"]').first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/featured-dashboard-market.png', fullPage: false });

    await page.goto('/dashboard/student', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    const studentRow = page.locator('[data-featured-carousel="row"]');
    await expect(studentRow).toBeVisible({ timeout: 30_000 });
    await studentRow.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/featured-student-dashboard.png', fullPage: false });
  });
});
