import { expect, test } from '@playwright/test';

test('Bahasa Melayu changes the public nav and the homepage hero', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const hero = page.getByRole('heading', { level: 1 });
  await expect(hero).toContainText('Learn your way.');
  await expect(hero).toContainText('Go further with AI.');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Start for free' })).toBeVisible();
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn your way.');

  const globe = page.getByRole('button', { name: 'Change language' });
  await expect(globe).toBeVisible();
  const globeBox = await globe.boundingBox();
  expect(globeBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((globeBox?.x ?? 0) + (globeBox?.width ?? 0)).toBeLessThanOrEqual(1280);
  const search = page.getByRole('textbox', { name: 'Search languages' });
  // The first click can land before hydration and do nothing. Click again until the menu stays open.
  await expect(async () => {
    if ((await globe.getAttribute('aria-expanded')) !== 'true') await globe.click();
    await expect(globe).toHaveAttribute('aria-expanded', 'true', { timeout: 1_500 });
    await expect(search).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await search.fill('Malay');
  await page.getByRole('button', { name: /Bahasa Melayu/ }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ms-MY');
  await expect(hero).toContainText('Belajar dengan cara anda.');
  await expect(hero).toContainText('Pergi lebih jauh dengan AI.');
  await expect(hero).not.toContainText('Learn your way.');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Mula percuma' })).toBeVisible();
  await expect(page.locator('#content').getByRole('link', { name: 'Mula percuma' }).first()).toBeVisible();
  await expect(page.locator('[data-landing-universities]')).toContainText('Menyediakan pelajar');
  await expect(page.getByRole('heading', { level: 2, name: 'Masalah yang pelajar, ibu bapa, dan sekolah benar-benar hadapi.' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Satu harga di seluruh dunia.' })).toBeVisible();
  await expect(page.getByText('The problems a student, a parent, and a school actually have.')).toHaveCount(0);
  const below = page.locator('#features');
  await below.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/qa/homepage/homepage-bahasa-below-hero.png' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: 'docs/qa/homepage/homepage-bahasa-below-hero-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/qa/homepage/homepage-bahasa-below-hero-mobile.png' });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: 'docs/qa/homepage/homepage-bahasa-below-hero-mobile-light.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  const malayNav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(malayNav.getByRole('link', { name: 'Laman Utama', exact: true })).toBeVisible();
  await expect(malayNav.getByRole('link', { name: 'Kursus', exact: true })).toBeVisible();
  await malayNav.locator('summary').click();
  await expect(malayNav.getByText('Program dan produk')).toBeVisible();
});
