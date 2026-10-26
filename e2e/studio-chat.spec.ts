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
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
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
}

async function expectDarkStudio(page: Page, role: 'student' | 'teacher') {
  await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible();
  await expect(page.locator('[data-studio-immersive="1"]')).toBeVisible();
  await expect(page.locator('[data-tour="sidebar"]')).toHaveCount(0);
  await expect(page.locator('[data-studio-nav="header"]')).toHaveCount(0);
  await expect(page.getByText('What this page is for')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'AI Studio' });
  await expect(nav).toHaveCount(1);
  const dashboard = nav.getByRole('link', { name: 'Dashboard', exact: true });
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toHaveAttribute('href', role === 'teacher' ? '/dashboard/teacher' : '/dashboard');
  for (const name of ['New chat', 'Chats', 'Library', 'All tools']) {
    await expect(nav.getByRole('button', { name, exact: true })).toBeVisible();
  }
  for (const name of ['AI Teachers', 'ET Maths', 'ET Exams', 'ET Essays', 'Book Studio', 'Planner', 'Calendar']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'ET + Subject', exact: true })).toHaveCount(0);
  await expect(nav.locator('[data-studio-placement="primary"]')).toHaveAttribute('href', '/dashboard/studio/teachers');
  await expect(nav.locator('[data-studio-dot="1"]').first()).toBeVisible();
  const chips = page.locator('[data-studio-tools="chips"]');
  await expect(chips).toBeVisible();
  for (const name of ['ET AI', 'PoketReads', 'AI Book Creator', 'Creator Store']) {
    await expect(chips.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Back to Poket School' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Poket SafeLine' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Help Center' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change language' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skills' })).toBeVisible();
  await expect(page.getByLabel('Subject')).toBeVisible();
  await expect(page.getByLabel('Level')).toBeVisible();
  await expect(page.getByLabel('Mode', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the guided tour' })).toBeVisible();
  const overflow = await page.locator('[data-studio-essentials="1"]').evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
  expect(overflow).toBe(true);
  await expect(nav.getByRole('button', { name: 'Research Helper', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Parent Explainer', exact: true })).toHaveCount(0);
  if (role === 'teacher') {
    await expect(nav.getByRole('link', { name: 'Timetabler', exact: true })).toBeVisible();
    await expect(page.locator('[data-studio-entry="timetable"]')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Teacher Toolkit', exact: true })).toBeVisible();
  } else {
    await expect(nav.getByRole('link', { name: 'Timetabler', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-studio-entry="timetable"]')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Teacher Toolkit', exact: true })).toHaveCount(0);
  }
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
  await expectDarkStudio(page, path.includes('/et') ? 'teacher' : 'student');
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${shot}-empty.png`, fullPage: false });
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
  const hops: { name: string; url: RegExp }[] = [
    { name: 'AI Teachers', url: /\/dashboard\/studio\/teachers|\/ai-teachers/ },
    { name: 'ET Maths', url: /\/dashboard\/studio\/maths/ },
    { name: 'ET Exams', url: /\/dashboard\/studio\/exam-prep/ },
    { name: 'ET Essays', url: /\/dashboard\/studio\/essays/ },
    { name: 'ET AI', url: /\/dashboard\/studio\/et/ },
  ];
  for (const hop of hops) {
    await dismissCookies(page);
    await page.getByRole('navigation', { name: 'AI Studio' }).getByRole('link', { name: hop.name, exact: true }).click();
    await expect(page).toHaveURL(hop.url, { timeout: 30_000 });
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
  await expectDarkStudio(page, email.startsWith('teacher') ? 'teacher' : 'student');
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
      { email: 'parent.e2e@poketschool.ai', role: 'parent', name: 'E2E Parent' },
      { email: 'institution.e2e@poketschool.ai', role: 'institution_admin', name: 'E2E Institution' },
      { email: 'admin.e2e@poketschool.ai', role: 'admin', name: 'E2E Admin' },
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

  test('dark layout keeps the tools for a student and opens on a phone', async ({ page }) => {
    await signIn(page, 'student.e2e@poketschool.ai');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('textbox', { name: 'Message ET AI' })).toBeVisible({ timeout: 60_000 });
    await expectDarkStudio(page, 'student');
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-desktop-1440.png', fullPage: false });
    await page.setViewportSize({ width: 1024, height: 640 });
    const fit = await page.evaluate(() => {
      const chips = document.querySelector('[data-studio-tools="chips"]')?.getBoundingClientRect();
      const composer = document.querySelector('[data-studio-composer="1"]')?.getBoundingClientRect();
      if (!chips || !composer) return { ok: false, reason: 'missing' };
      const overlaps = chips.bottom > composer.top + 1;
      const within = chips.top >= 0 && chips.bottom <= window.innerHeight + 1 && composer.bottom <= window.innerHeight + 1;
      return { ok: !overlaps && within, overlaps, within, chipsBottom: chips.bottom, composerTop: composer.top, height: window.innerHeight };
    });
    expect(fit.ok, JSON.stringify(fit)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-student-empty.png', fullPage: false });
    await page.locator('[data-photo-file="1"]').setInputFiles('public/blog/thumbs/igcse-revision-with-et-ai.webp');
    await expect(page.getByText('Photo attached')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-photo.png', fullPage: false });
    await page.getByRole('button', { name: 'Explain quadratic equations' }).click();
    await expect(page.locator('[data-assistant="1"]').last()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Read aloud' }).last()).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-student-reply.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-studio-tools="row"]').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Open ET AI menu"]')?.click();
    });
    await expect(page.getByRole('button', { name: 'Open ET AI menu' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'AI Studio' })).toBeVisible();
    await expect(page.locator('[data-studio-sidebar="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-mobile-sidebar.png', fullPage: false });
  });

  test('dark layout keeps the teacher tools', async ({ page }) => {
    await signIn(page, 'teacher.e2e@poketschool.ai');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('textbox', { name: 'Message ET AI' })).toBeVisible({ timeout: 60_000 });
    await expectDarkStudio(page, 'teacher');
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-dark-teacher.png', fullPage: false });
    const cluster = page.locator('[data-studio-essentials="1"]');
    await cluster.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-top-right-no-scrollbar.png' });
    await page.goto('/dashboard/studio/teachers', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('link', { name: 'ET Science' }).first()).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teachers-grid-dark-desktop.png', fullPage: false });
    await page.goto('/dashboard/studio/teachers/et-science', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.getByRole('button', { name: 'Upload photo' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Skills' })).toBeVisible();
    await expect(page.getByLabel('Subject')).toBeVisible();
    await expect(page.getByLabel('Level')).toBeVisible();
    await expect(page.getByLabel('Mode', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read aloud' })).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teacher-chat-dark-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teachers-chat-dark-mobile.png', fullPage: false });
  });

  test('theme toggle switches the shell and keeps the choice', async ({ page }) => {
    await signIn(page, 'student.e2e@poketschool.ai');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard/studio', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /Switch to light mode/ }).click();
    await expect(page.locator('[data-studio-layout="light"]')).toBeVisible();
    await expect(page.locator('[data-tour="sidebar"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to Poket School' })).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-light-desktop.png', fullPage: false });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await expect(page.locator('[data-studio-layout="light"]')).toBeVisible({ timeout: 60_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/studio-light-mobile.png', fullPage: false });
  });

  test('each role opens one tool in the shell in both themes', async ({ page }) => {
    test.setTimeout(180_000);
    const visits = [
      { email: 'student.e2e@poketschool.ai', path: '/dashboard/studio/maths', shot: 'tool-student-maths' },
      { email: 'teacher.e2e@poketschool.ai', path: '/dashboard/teacher/upload', shot: 'tool-teacher-upload' },
      { email: 'parent.e2e@poketschool.ai', path: '/dashboard/parent/planner', shot: 'tool-parent-planner' },
      { email: 'institution.e2e@poketschool.ai', path: '/dashboard/studio/timetable', shot: 'tool-institution-timetable' },
      { email: 'admin.e2e@poketschool.ai', path: '/dashboard/admin/books', shot: 'tool-admin-books' },
    ];
    for (const visit of visits) {
      await signIn(page, visit.email);
      await page.setViewportSize({ width: 1280, height: 800 });
      let opened = false;
      for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
        try {
          await page.goto(visit.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          opened = true;
        } catch (error) {
          if (attempt === 2) throw error;
          await page.waitForTimeout(1_500);
        }
      }
      await dismissCookies(page);
      await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-studio-immersive="1"]')).toBeVisible();
      await expect(page.locator('[data-tour="sidebar"]')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Dashboard', exact: true }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to Poket School' })).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'AI Studio' });
      await expect(nav.locator('[aria-current="page"]').first()).toBeVisible();
      await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${visit.shot}-dark.png`, fullPage: false });
      await page.evaluate(() => localStorage.setItem('theme', 'light'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await dismissCookies(page);
      await expect(page.locator('[data-studio-layout="light"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-tour="sidebar"]')).toHaveCount(0);
      await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${visit.shot}-light.png`, fullPage: false });
    }
  });
});

test('public AI teachers and Book Studio use the shell in both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: true, analytics: false, aiPerformance: false, decidedAt: '2026-10-19T00:00:00.000Z',
    }));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/ai-teachers', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Poket School' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'AI Studio' })).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teachers-dark-desktop.png', fullPage: false });
  await page.getByRole('button', { name: /Switch to light mode/ }).click();
  await expect(page.locator('[data-studio-layout="light"]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teachers-light-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/ai-teachers-light-mobile.png', fullPage: false });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/reads/studio', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New book', exact: true })).toBeVisible();
  const previewTab = page.locator('[data-book-tab="preview"]');
  await expect(previewTab).toBeVisible();
  await expect(async () => {
    await previewTab.click();
    await expect(page.locator('[data-book-preview="1"]')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-studio-dark-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-studio-dark-mobile.png', fullPage: false });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /Switch to light mode/ }).click();
  await expect(page.locator('[data-studio-layout="light"]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-studio-light-desktop.png', fullPage: false });
});
