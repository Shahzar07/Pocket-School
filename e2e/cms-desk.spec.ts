import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const LIVE = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;
const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';
const ADMIN_EMAIL = 'admin.e2e@poketschool.ai';
const TEACHER_EMAIL = 'teacher.e2e@poketschool.ai';
const STUDENT_EMAIL = 'student.e2e@poketschool.ai';
const COURSE = 'cms-e2e-cells';
const MODULE = 'cms-e2e-unit';
const LESSON = 'cms-e2e-lesson';

const MIND = JSON.stringify({
  center: 'Cells',
  branches: [
    { keyword: 'Nucleus', children: [{ keyword: 'DNA' }] },
    { keyword: 'Wall', children: [{ keyword: 'Cellulose' }] },
  ],
});

const INFO = '# Plant cell\n\n## Parts\n\n- Nucleus\n- Cell wall\n';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.getByRole('button', { name: /Accept all|Terima semua/ }).click().catch(() => undefined);
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
  await page.evaluate(() => localStorage.setItem('poket-pip-onboarded', '1'));
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Account menu' }).first()).toBeVisible({ timeout: 60_000 });
  await dismissCookies(page);
}

async function openPath(page: Page, path: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const retry = message.includes('ERR_ABORTED') || message.includes('ERR_CONNECTION_RESET') || message.includes('ERR_CONNECTION_REFUSED');
      if (attempt === 3 || !retry) throw error;
      await page.waitForTimeout(2000);
    }
  }
}

async function ensureUser(email: string, claims: Record<string, string>, profile: Record<string, unknown>) {
  const auth = adminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, emailVerified: false });
  }
  await auth.setCustomUserClaims(user.uid, claims);
  await adminDb().collection('users').doc(user.uid).set({
    email,
    emailVerified: false,
    twoFactorEnabled: false,
    ...profile,
  }, { merge: true });
  return user.uid;
}

test.describe('course builder desk', () => {
  test.skip(!LIVE, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to open the course builder.');

  test.beforeAll(async () => {
    if (!LIVE) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const adminId = await ensureUser(ADMIN_EMAIL, { role: 'admin', adminRole: 'super_admin' }, {
      role: 'admin',
      adminRole: 'super_admin',
      name: 'E2E Admin',
    });
    const teacherId = await ensureUser(TEACHER_EMAIL, { role: 'teacher' }, {
      role: 'teacher',
      name: 'Amina Teacher',
      permissions: ['addon:cms'],
    });
    const studentId = await ensureUser(STUDENT_EMAIL, { role: 'student' }, {
      role: 'student',
      name: 'E2E Student',
    });
    const db = adminDb();
    await db.collection('courses').doc(COURSE).set({
      title: 'Cells and tissues',
      description: 'A labelled sample lesson for the course builder.',
      subject: 'Science',
      ownerId: adminId,
      status: 'published',
      isPublic: false,
      kind: 'curriculum',
      yearGroup: 'Lower Secondary',
      downloadsEnabled: true,
    });
    await db.collection('courses').doc(COURSE).collection('modules').doc(MODULE).set({
      title: 'Cells',
      courseId: COURSE,
      order: 1,
      unitNumber: 1,
    });
    await db.collection('courses').doc(COURSE).collection('modules').doc(MODULE).collection('lessons').doc(LESSON).set({
      title: 'Plant cells',
      moduleId: MODULE,
      courseId: COURSE,
      order: 1,
      lessonNumber: 1,
      status: 'draft',
      lessonType: 'lesson',
      blocksOrder: ['text', 'mindmap', 'infographic'],
      aiOutputs: {
        text: 'A plant cell has a nucleus and a cell wall.',
        mindmap: MIND,
        infographic: INFO,
      },
      localizations: {
        ms: { title: 'Sel tumbuhan', text: 'Sel tumbuhan mempunyai nukleus dan dinding sel.', source: 'manual' },
      },
    });
    await db.collection('courses').doc(COURSE).collection('enrollments').doc(studentId).set({
      studentId,
      courseId: COURSE,
      status: 'active',
    });
    await db.collection('lesson_notes').doc(`${studentId}_${LESSON}`).set({
      userId: studentId,
      lessonId: LESSON,
      text: '',
    });
    void teacherId;
  });

  test('the builder shows one block grid, a course title, maps, and a teacher-only signature', async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, ADMIN_EMAIL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPath(page, '/dashboard/admin/curriculum');
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Curriculum CMS' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-copyright-sign="1"]')).toHaveCount(0);
    await page.screenshot({ path: 'docs/qa/cms/cms-list-light.png' });

    await openPath(page, `/dashboard/admin/curriculum/${COURSE}?lesson=${LESSON}`);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Cells and tissues', { timeout: 60_000 });
    await expect(page.locator('[data-block-grid="1"]')).toBeVisible();
    await expect(page.locator('[data-block-id="image"]')).toHaveCount(1);
    await expect(page.locator('[data-block-id="illustration"]')).toHaveCount(1);
    await expect(page.locator('[data-block-id="infographic"]')).toHaveCount(1);
    await expect(page.locator('[data-block-id="infographicImage"]')).toHaveCount(1);
    await expect(page.locator('[data-format-block="mindmap"] [role="img"]')).toBeVisible();
    await expect(page.locator('[data-format-block="infographic"]')).toContainText('Plant cell');
    await expect(page.locator('[data-format-block="infographic"]')).not.toContainText('%');
    const mapBox = await page.locator('[data-format-block="mindmap"]').boundingBox();
    const exportBox = await page.locator('[data-export-toolbar="1"]').boundingBox();
    const actions = page.locator('[data-lesson-actions="1"]');
    await expect(actions).toBeVisible();
    const actionBox = await actions.boundingBox();
    if (mapBox && exportBox) {
      const overlap = exportBox.y < mapBox.y + mapBox.height && exportBox.y + exportBox.height > mapBox.y
        && exportBox.x < mapBox.x + mapBox.width && exportBox.x + exportBox.width > mapBox.x;
      expect(overlap).toBe(false);
    }
    if (actionBox && exportBox) {
      const overlap = exportBox.y < actionBox.y + actionBox.height && exportBox.y + exportBox.height > actionBox.y
        && exportBox.x < actionBox.x + actionBox.width && exportBox.x + exportBox.width > actionBox.x;
      expect(overlap).toBe(false);
    }
    await page.screenshot({ path: 'docs/qa/cms/cms-builder-light.png', fullPage: false });

    await page.locator('[data-right-tab="publish"]').click();
    await expect(page.locator('[data-downloads="1"]')).toBeVisible();
    await page.screenshot({ path: 'docs/qa/cms/cms-publish-panel.png' });

    await page.locator('[data-publish-lesson="1"]').click();
    const publishDialog = page.locator('[data-publish-dialog="1"]');
    await expect(publishDialog).toBeVisible();
    await expect(publishDialog.locator('[data-copyright-gate="teacher"]')).toHaveCount(0);
    await page.screenshot({ path: 'docs/qa/cms/cms-publish-admin.png' });
    await publishDialog.getByRole('button', { name: 'Cancel' }).click();

    await page.locator('[data-block-id="mindmapImage"]').click();
    const alt = page.locator('[data-alt-text="1"]');
    await expect(alt).toBeVisible();
    await expect(page.locator('[data-mi-tag="1"]')).toBeVisible();
    await alt.fill('A labelled diagram of a plant cell');
    await page.locator('[data-mi-tag="1"]').selectOption('Spatial');
    await page.screenshot({ path: 'docs/qa/cms/cms-alt-mi.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/qa/cms/cms-builder-mobile.png' });

    await signIn(page, TEACHER_EMAIL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPath(page, `/dashboard/admin/curriculum/${COURSE}?lesson=${LESSON}`);
    await expect(page.locator('[data-publish-lesson="1"]')).toBeEnabled({ timeout: 60_000 });
    await page.locator('[data-publish-lesson="1"]').click();
    await expect(page.locator('[data-copyright-gate="teacher"]')).toBeVisible();
    await page.screenshot({ path: 'docs/qa/cms/cms-copyright-teacher.png' });
  });

  test('a student reads the saved Bahasa Melayu lesson', async ({ page }) => {
    test.setTimeout(90_000);
    await adminDb().collection('courses').doc(COURSE).collection('modules').doc(MODULE).collection('lessons').doc(LESSON).update({
      status: 'published',
    });
    await signIn(page, STUDENT_EMAIL);
    await page.evaluate(() => {
      localStorage.setItem('pocket-school-lang', 'ms');
      localStorage.setItem('pocket-school-lang-source', 'user');
      document.cookie = 'poket-lang=ms; Path=/; SameSite=Lax';
    });
    page.setDefaultNavigationTimeout(25_000);
    await openPath(page, `/dashboard/student/courses/${COURSE}/lessons/${LESSON}`);
    await dismissCookies(page);
    await expect(page.getByRole('heading', { name: 'Sel tumbuhan' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'docs/qa/cms/cms-student-translation.png' });
  });
});
