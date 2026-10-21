import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
});

test('the homepage header scrolls away and other pages keep it fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const header = page.locator('[data-site-header]');
  await expect(header).toHaveAttribute('data-site-header', 'flow');
  const homePosition = await header.evaluate((node) => getComputedStyle(node).position);
  expect(homePosition).toBe('absolute');
  await page.evaluate(() => window.scrollTo(0, 900));
  const top = await header.evaluate((node) => node.getBoundingClientRect().top);
  expect(top).toBeLessThan(0);

  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  const fixed = page.locator('[data-site-header]');
  await expect(fixed).toHaveAttribute('data-site-header', 'fixed');
  expect(await fixed.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
  await page.evaluate(() => window.scrollTo(0, 900));
  const pinned = await fixed.evaluate((node) => node.getBoundingClientRect().top);
  expect(pinned).toBeGreaterThanOrEqual(0);
  expect(pinned).toBeLessThan(8);
});

test('public profile pages hide the site header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/p/sample', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Poket School alumni')).toBeVisible();
  await expect(page.locator('[data-site-header]')).toHaveCount(0);
  await expect(page.getByRole('banner')).toHaveCount(0);
});

test('Programmes and products matches the other nav links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const linkSize = await nav.getByRole('link', { name: 'Home', exact: true }).evaluate((node) => getComputedStyle(node).fontSize);
  const summarySize = await nav.locator('summary').evaluate((node) => getComputedStyle(node).fontSize);
  expect(linkSize).toBe('12px');
  expect(summarySize).toBe(linkSize);
});
