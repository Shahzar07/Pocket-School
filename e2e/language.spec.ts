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
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start for free' })).toBeVisible();

  const globe = page.getByRole('button', { name: 'Change language' });
  await expect(globe).toBeVisible();
  const globeBox = await globe.boundingBox();
  expect(globeBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((globeBox?.x ?? 0) + (globeBox?.width ?? 0)).toBeLessThanOrEqual(1280);
  await globe.click();
  await page.getByRole('textbox', { name: 'Search languages' }).fill('Malay');
  await page.getByRole('button', { name: /Bahasa Melayu/ }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ms-MY');
  await expect(hero).toContainText('Belajar dengan cara anda.');
  await expect(hero).toContainText('Pergi lebih jauh dengan AI.');
  await expect(hero).not.toContainText('Learn your way.');
  const malayNav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(malayNav.getByRole('link', { name: 'Laman Utama', exact: true })).toBeVisible();
  await expect(malayNav.getByRole('link', { name: 'Kursus', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Mula percuma' })).toBeVisible();
  await expect(page.locator('#content').getByRole('link', { name: 'Mula percuma' })).toBeVisible();
  await expect(malayNav.getByText('Program dan produk')).toBeVisible();
});
