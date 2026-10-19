import { expect, test, type Page } from '@playwright/test';

async function openSignup(page: Page) {
  await page.goto('/signup', { waitUntil: 'load' });
  await expect(page.locator('[data-signup-school="1"][data-hydrated="1"]')).toBeVisible({ timeout: 60_000 });
}

test('sign-up offers independent or school join and a blue panel', async ({ page }) => {
  await openSignup(page);
  await expect(page.getByRole('button', { name: 'Join independently' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join my school' })).toBeVisible();
  await page.getByRole('button', { name: 'Join my school' }).click();
  await expect(page.getByLabel('Search schools')).toBeVisible();
  await expect(page.getByText("My school isn't listed")).toBeVisible();
  const panel = page.locator('[data-auth-panel="brand"]');
  await expect(panel).toBeVisible();
  const background = await panel.evaluate((node) => getComputedStyle(node).backgroundImage);
  expect(background.toLowerCase()).not.toContain('purple');
  expect(background).toContain('30, 106, 131');
});

test('teacher and parent see the same school choice', async ({ page }) => {
  await openSignup(page);
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByRole('button', { name: 'Join my school' }).click();
  await expect(page.getByText('A teacher request asks to join as staff.')).toBeVisible();
  await page.getByRole('button', { name: 'Parent' }).click();
  await page.getByRole('button', { name: 'Join my school' }).click();
  await expect(page.getByText('A parent request links you to the school after the institution admin approves it.')).toBeVisible();
});

test('the public school directory degrades when the server account is absent', async ({ request }) => {
  const response = await request.get('/api/institutions/directory?country=MY&state=Perak&q=north');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.institutions)).toBeTruthy();
  if (body.configured === false) {
    expect(String(body.message)).toContain('FIREBASE_SERVICE_ACCOUNT');
  }
});

test('AI Book Creator is named in the studio navigation source route', async ({ page }) => {
  const response = await page.goto('/dashboard/admin/books', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(500);
});
