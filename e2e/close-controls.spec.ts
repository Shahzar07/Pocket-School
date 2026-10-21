import { expect, test, type Page } from '@playwright/test';

async function contrast(page: Page, selector: string, index = 0): Promise<number> {
  return page.locator(selector).nth(index).evaluate((node) => {
    const read = (value: string) => {
      const parts = value.match(/\d+(\.\d+)?/g)?.slice(0, 4).map(Number) ?? [0, 0, 0, 1];
      const alpha = parts[3] ?? 1;
      const rgb = parts.slice(0, 3).map((channel) => {
        const unit = channel / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return { rgb, alpha };
    };
    const lum = (channels: number[]) => 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    let current: Element | null = node;
    let fg = read(getComputedStyle(node).color);
    let bg = { rgb: [1, 1, 1], alpha: 0 };
    while (current) {
      const next = read(getComputedStyle(current).backgroundColor);
      if (next.alpha > 0.05) {
        bg = next;
        break;
      }
      current = current.parentElement;
    }
    const lighter = Math.max(lum(fg.rgb), lum(bg.rgb));
    const darker = Math.min(lum(fg.rgb), lum(bg.rgb));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

test('cookie notice closes with the X, Escape, and stays dismissed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.removeItem('poket-cookie-consent');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  const close = dialog.getByRole('button', { name: 'Close' });
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await close.focus();
  const ring = await close.evaluate((node) => getComputedStyle(node).boxShadow);
  expect(ring).not.toBe('none');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('poket-cookie-consent'))).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(dialog).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.removeItem('poket-cookie-consent');
    localStorage.setItem('theme', 'dark');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  const darkClose = page.getByRole('dialog', { name: 'Cookie consent' }).getByRole('button', { name: 'Close' });
  await expect(darkClose).toBeVisible();
  await darkClose.click();
  await expect(page.getByRole('dialog', { name: 'Cookie consent' })).toBeHidden();
});

test('Book Studio featured controls read in the shell light and dark themes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/reads/studio', { waitUntil: 'domcontentloaded' });
  const featured = page.locator('[data-book-featured="1"]');
  await expect(featured).toBeVisible();
  await expect(featured.getByRole('checkbox')).toBeVisible();
  await expect(featured.locator('input[type="number"]')).toBeVisible();
  await expect(featured.locator('input[type="date"]')).toHaveCount(2);
  const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
  await expect(toggle).toBeVisible();
  const label = await toggle.getAttribute('aria-label');
  if (label?.includes('light')) await toggle.click();
  await expect(page.locator('[data-studio-layout="light"]')).toBeVisible();
  expect(await contrast(page, '[data-book-featured="1"]')).toBeGreaterThan(4.5);
  expect(await contrast(page, '[data-book-featured="1"] input[type="number"]')).toBeGreaterThan(4.5);
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-featured-light.png', fullPage: false });

  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await expect(page.locator('[data-studio-layout="dark"]')).toBeVisible();
  expect(await contrast(page, '[data-book-featured="1"]')).toBeGreaterThan(4.5);
  expect(await contrast(page, '[data-book-featured="1"] input[type="number"]')).toBeGreaterThan(4.5);
  expect(await contrast(page, '[data-book-featured="1"] input[type="date"]', 0)).toBeGreaterThan(4.5);
  expect(await contrast(page, '[data-book-featured="1"] input[type="date"]', 1)).toBeGreaterThan(4.5);
  await page.setViewportSize({ width: 390, height: 844 });
  await featured.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/book-featured-dark-mobile.png', fullPage: false });
});
