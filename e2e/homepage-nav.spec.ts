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
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 900);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
  const top = await header.evaluate((node) => node.getBoundingClientRect().top);
  expect(top).toBeLessThan(0);

  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  const fixed = page.locator('[data-site-header]');
  await expect(fixed).toHaveAttribute('data-site-header', 'fixed');
  expect(await fixed.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 900);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
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

test('the landing page has no menu bar and no scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /navigation/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Poket School', exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change language' })).toBeVisible();
  const header = page.locator('[data-site-header="flow"]');
  const overflow = await header.evaluate((node) => node.scrollWidth > node.clientWidth + 2);
  expect(overflow).toBe(false);
  await expect(page.getByRole('heading', { name: 'Product' })).toBeVisible();
  await expect(page.locator('[data-landing-universities]')).toContainText('University of Oxford');
  await expect(page.locator('[data-landing-teach]')).toContainText('visual learners');
});

test('other pages keep a menu that does not scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  const box = await nav.boundingBox();
  const scroll = await nav.evaluate((node) => node.scrollWidth > node.clientWidth + 2);
  expect(scroll).toBe(false);
  expect((box?.width ?? 0)).toBeLessThan(1024);
});
