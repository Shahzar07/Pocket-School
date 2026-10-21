import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { adminAuth, adminDb } from '../lib/firebase-admin';
import { SAMPLE_MANIFEST } from '../lib/store/sample';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const EMAIL = 'admin.e2e@poketschool.ai';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function pdf(label: string): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj<< /Title (${label}) >>endobj\ntrailer<<>>\n%%EOF\n`);
}

async function sampleZip(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('manifest.csv', SAMPLE_MANIFEST);
  const rows = [
    ['PS-4MA1-H-P1', 'PS-4MA1-H-P1_PAPER.pdf', 'PS-4MA1-H-P1_MARK_SCHEME.pdf', ['preview-1.png', 'preview-2.png']],
    ['PS-4BI1-F-N1', 'PS-4BI1-F-N1_PAPER.pdf', 'PS-4BI1-F-N1_MARK_SCHEME.pdf', ['preview-1.png']],
  ] as const;
  rows.forEach(([sku, paper, scheme, previews], index) => {
    const folder = zip.folder(sku);
    folder?.file(paper, pdf(`paper-${index}`));
    folder?.file(scheme, pdf(`scheme-${index}`));
    folder?.file('thumb.png', PNG);
    previews.forEach(name => folder?.file(name, PNG));
  });
  return zip.generateAsync({ type: 'nodebuffer' });
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
    emailVerified: true,
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
  await page.goto('/dashboard/admin/store/import', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  return data.idToken;
}

test.describe('creator store import', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to import store files.');
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
    const rules = readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8');
    const loaded = await fetch('http://127.0.0.1:9199/internal/setRules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { files: [{ name: 'storage.rules', content: rules }] } }),
    });
    if (!loaded.ok) throw new Error(`Storage rules were not loaded (${loaded.status}).`);
    const auth = adminAuth();
    let record;
    try {
      record = await auth.getUserByEmail(EMAIL);
      await auth.updateUser(record.uid, { password: PASSWORD, emailVerified: true });
    } catch {
      record = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true });
    }
    await adminDb().doc(`users/${record.uid}`).set({
      role: 'admin',
      adminRole: 'admin',
      email: EMAIL,
      name: 'E2E Admin',
    }, { merge: true });
  });

  test('imports two draft products and refuses a signed URL without a service account', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('poket-pip-onboarded', '1');
      localStorage.setItem('poket-cookie-consent', JSON.stringify({
        essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
      }));
    });
    const zip = await sampleZip();
    await signIn(page);
    await dismissCookies(page);
    await expect(page.locator('[data-store-import="1"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-setup-note="1"]')).toContainText('Setup needed');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('input[type="file"]').setInputFiles({
      name: 'sample-store.zip',
      mimeType: 'application/zip',
      buffer: zip,
    });
    await page.locator('[data-dry-run="1"]').click();
    await expect(page.locator('[data-import-row="PS-4MA1-H-P1"]')).toHaveAttribute('data-row-state', 'ready');
    await expect(page.locator('[data-import-row="PS-4BI1-F-N1"]')).toHaveAttribute('data-row-state', 'ready');
    await page.screenshot({ path: 'docs/qa/store/import-dry-run-desktop.png', fullPage: true });

    await dismissCookies(page);
    await page.locator('[data-import-drafts="1"]').click();
    await expect(page.locator('[data-import-row="PS-4MA1-H-P1"]')).toHaveAttribute('data-product-status', 'draft', { timeout: 60_000 });
    await expect(page.locator('[data-import-row="PS-4BI1-F-N1"]')).toHaveAttribute('data-product-status', 'draft');
    await expect(page.locator('[data-import-progress="1"]')).toContainText('2/2');
    const productId = await page.locator('[data-import-row="PS-4MA1-H-P1"]').getAttribute('data-product-id');
    expect(productId).toBeTruthy();

    await page.locator('[data-check-download="PS-4MA1-H-P1"]').click();
    await expect(page.locator('[data-setup-needed="1"]')).toContainText('Setup needed');
    await expect(page.locator('[data-setup-needed="1"]')).not.toContainText('https://');
    await page.screenshot({ path: 'docs/qa/store/import-drafts-desktop.png', fullPage: true });

    const bucket = 'ringed-sentinel-436615-c2.firebasestorage.app';
    const thumb = await fetch(`http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(`store/products/${productId}/thumbs/cover.webp`)}?alt=media`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type') ?? '').toContain('image/webp');
    const secret = await fetch(`http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(`store/products/${productId}/private/paper.pdf`)}?alt=media`);
    expect(secret.status).toBeGreaterThanOrEqual(400);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'sample-store.zip',
      mimeType: 'application/zip',
      buffer: zip,
    });
    await dismissCookies(page);
    await page.locator('[data-dry-run="1"]').click();
    await dismissCookies(page);
    await page.locator('[data-resume="1"]').click();
    await expect(page.locator('[data-import-row="PS-4MA1-H-P1"]')).toHaveAttribute('data-row-state', 'resumed', { timeout: 60_000 });
    await expect(page.locator('[data-import-row="PS-4BI1-F-N1"]')).toHaveAttribute('data-row-state', 'resumed');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/qa/store/import-drafts-mobile.png', fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard/store', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    const form = page.locator('[data-product-upload="1"]');
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.locator('input[name="sku"]').fill('PS-4CH1-H-P1');
    await form.locator('input[name="title"]').fill('Chemistry Paper 1');
    await form.locator('input[name="subject"]').fill('Chemistry');
    await form.locator('input[name="level"]').fill('Higher');
    await form.locator('input[name="exam_board"]').fill('Pearson Edexcel');
    await form.locator('input[name="spec_code"]').fill('4CH1');
    await form.locator('input[name="type"]').fill('paper');
    await form.locator('select[name="access"]').selectOption('paid');
    await form.locator('input[name="price_usd"]').fill('4.00');
    await form.locator('input[name="price_myr"]').fill('16.00');
    await form.locator('textarea[name="description"]').fill('A single higher paper with a separate mark scheme.');
    await form.locator('input[name="tags"]').fill('chemistry|paper');
    await form.locator('input[name="paper"]').setInputFiles({ name: 'paper.pdf', mimeType: 'application/pdf', buffer: pdf('chem-paper') });
    await form.locator('input[name="markscheme"]').setInputFiles({ name: 'markscheme.pdf', mimeType: 'application/pdf', buffer: pdf('chem-scheme') });
    await form.locator('input[name="thumbnail"]').setInputFiles({ name: 'thumb.png', mimeType: 'image/png', buffer: PNG });
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-product-result="1"]')).toHaveText('Draft saved', { timeout: 30_000 });
    await page.screenshot({ path: 'docs/qa/store/product-form-desktop.png', fullPage: true });
  });
});
