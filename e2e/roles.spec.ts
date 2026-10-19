import { expect, test, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../lib/firebase-admin';

const PASSWORD = process.env.E2E_PREVIEW_PASSWORD || '';
const ROLE_JOURNEY = process.env.E2E_EMULATOR === '1' && PASSWORD.length > 0;

const PUBLIC_PAGES = [
  '/',
  '/ai-teachers',
  '/studio',
  '/reads',
  '/safeline',
  '/id',
  '/primary',
  '/igcse',
  '/alevel',
  '/llb',
  '/mbbs',
  '/independent',
  '/institutions',
  '/institutions/register',
  '/demo',
  '/about',
  '/rochfords',
  '/privacy',
  '/terms',
  '/signup?plan=primary',
];

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.getByRole('button', { name: 'Accept all' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }
}

const API_KEY = 'AIzaSyCh4W5ioD6lcD1Sb8Y3cE601t6bVVVchKU';

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
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
}

async function openDash(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
}

test('marketing pages from the landing footer answer', async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0, path).toBeLessThan(400);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    if (path === '/ai-teachers') {
      await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/teacher-portraits.png', fullPage: false });
    }
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-landing="v3"]')).toBeVisible();
  const html = await page.locator('[data-landing="v3"]').innerHTML();
  expect(html.toLowerCase()).not.toContain('#c8820a');
  expect(html).not.toContain('Years 1');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/landing-v3.png', fullPage: false });
});

test.describe('role journeys on the emulator preview', () => {
  test.skip(!ROLE_JOURNEY, 'Set E2E_EMULATOR=1 and E2E_PREVIEW_PASSWORD to run these against the preview.');

  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    if (!ROLE_JOURNEY) return;
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    const auth = adminAuth();
    const db = adminDb();
    const people = [
      { key: 'student', email: 'student.e2e@poketschool.ai', profile: { role: 'student', name: 'E2E Learner', emailVerified: false, twoFactorEnabled: false } },
      { key: 'parent', email: 'parent.e2e@poketschool.ai', profile: { role: 'parent', name: 'E2E Parent', emailVerified: false, twoFactorEnabled: false, childIds: [] as string[] } },
      { key: 'teacher', email: 'teacher.e2e@poketschool.ai', profile: { role: 'teacher', name: 'E2E Teacher', emailVerified: false, twoFactorEnabled: false } },
      { key: 'institution', email: 'institution.e2e@poketschool.ai', profile: { role: 'institution_admin', name: 'E2E Institution', institutionId: 'e2e-school', emailVerified: false, twoFactorEnabled: false } },
      { key: 'admin', email: 'admin.e2e@poketschool.ai', profile: { role: 'admin', adminRole: 'super_admin', name: 'E2E Admin', emailVerified: false, twoFactorEnabled: false } },
    ] as const;
    for (const person of people) {
      let user;
      try {
        user = await auth.getUserByEmail(person.email);
        await auth.updateUser(user.uid, { password: PASSWORD, emailVerified: false });
      } catch {
        user = await auth.createUser({ email: person.email, password: PASSWORD, emailVerified: false });
      }
      ids[person.key] = user.uid;
      await db.collection('users').doc(user.uid).set({ ...person.profile, email: person.email }, { merge: true });
    }
    await db.collection('users').doc(ids.parent).set({ childIds: [ids.student] }, { merge: true });
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await db.collection('daily_goals').doc('e2e-goal').set({
      studentId: ids.student,
      studentName: 'E2E Learner',
      dateKey,
      title: 'E2E reading goal',
      category: 'reading',
      estimateMinutes: 20,
      deadline: '18:00',
      status: 'not_started',
    });
    await db.collection('report_cards').doc('e2e-card').set({
      studentId: ids.student,
      teacherId: ids.teacher,
      studentName: 'E2E Learner',
      courseTitle: 'IGCSE Biology',
      grade: '9',
      heading: 'E2E report',
      termId: 'Term 1',
      year: 2026,
      comment: 'Steady work.',
    });
    await db.collection('institutions').doc('e2e-school').set({
      name: 'E2E Academy',
      status: 'active',
      branding: { displayName: 'E2E Academy' },
      adminId: ids.institution,
    }, { merge: true });
    await db.collection('school_classes').doc('e2e-class').set({
      name: 'E2E Biology',
      institutionId: 'e2e-school',
      ownerTeacherId: ids.teacher,
      ownerTeacherName: 'E2E Teacher',
      visibility: 'private',
      inviteAutoApprove: true,
      institutionKind: 'school',
      joinCode: 'JOIN-E2E1',
      status: 'active',
      subject: 'Biology',
      level: 'IGCSE',
    });
    await db.collection('institutions').doc('e2e-school').collection('join_requests').doc(ids.student).set({
      userId: ids.student,
      role: 'student',
      name: 'E2E Learner',
      email: 'student.e2e@poketschool.ai',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });

  test('student opens the planner', async ({ page }) => {
    await signIn(page, 'student.e2e@poketschool.ai');
    await openDash(page, '/dashboard/student/planner');
    await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-planner-board="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/planner-student.png', fullPage: false });
  });

  test('parent sees a grade and a goal', async ({ page }) => {
    await signIn(page, 'parent.e2e@poketschool.ai');
    await openDash(page, '/dashboard/parent/goals');
    await expect(page.getByText('E2E reading goal').first()).toBeVisible({ timeout: 60_000 });
    await openDash(page, '/dashboard/parent/reports');
    await expect(page.getByText('grade 9')).toBeVisible({ timeout: 30_000 });
    await openDash(page, '/dashboard/parent/planner');
    await expect(page.locator('[data-planner-board="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/planner-parent.png', fullPage: false });
  });

  test('teacher opens a classroom and the course copyright signature', async ({ page }) => {
    await signIn(page, 'teacher.e2e@poketschool.ai');
    await openDash(page, '/dashboard/teacher/classes');
    await expect(page.getByLabel('Who can join')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/private-classroom.png', fullPage: false });
    await openDash(page, '/dashboard/teacher/upload');
    await expect(page.locator('[data-copyright-sign="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/esign-course.png', fullPage: false });
    await openDash(page, '/dashboard/teacher/planner');
    await expect(page.locator('[data-planner-view="month"]')).toBeVisible();
  });

  test('institution admin opens onboarding and approves a student', async ({ page }) => {
    await signIn(page, 'institution.e2e@poketschool.ai');
    await openDash(page, '/dashboard/institution/onboarding');
    await expect(page.getByRole('heading', { name: 'Onboarding' })).toBeVisible();
    await openDash(page, '/dashboard/institution/approvals');
    await expect(page.getByText('E2E Learner')).toBeVisible({ timeout: 30_000 });
    await dismissCookies(page);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('approved')).toBeVisible({ timeout: 30_000 });
  });

  test('admin opens the desk, signatures, AI Book Creator, and the blog', async ({ page }) => {
    await signIn(page, 'admin.e2e@poketschool.ai');
    await openDash(page, '/dashboard/admin');
    await expect(page.getByText('Admin desk')).toBeVisible();
    await openDash(page, '/dashboard/admin/signatures');
    await expect(page.getByRole('heading', { name: 'Copyright signatures' })).toBeVisible();
    await expect(page.locator('[data-signature-search="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/esign-admin.png', fullPage: false });
    await openDash(page, '/dashboard/admin/planner');
    await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible();
    await expect(page.locator('[data-planner-board="1"]')).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/planner-admin.png', fullPage: false });
    await openDash(page, '/dashboard/admin/books');
    await expect(page.getByRole('link', { name: 'AI Book Creator' })).toBeVisible();
    await expect(page.locator('[data-book-status]').first()).toBeVisible();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('[data-library-preview="1"]')).toBeVisible();
    await expect(page.locator('[data-reader-preview="1"]')).toBeVisible();
    await openDash(page, '/dashboard/admin/blog');
    await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
  });
});
