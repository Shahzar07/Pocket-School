import { expect, test, type Locator, type Page } from '@playwright/test';

function inside(box: { x: number; y: number; width: number; height: number } | null, width: number, height: number) {
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
}

async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  if (await b.count() === 0) return false;
  const left = await a.boundingBox();
  const right = await b.boundingBox();
  if (!left || !right) return false;
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

async function fresh(page: Page, path: string) {
  await page.addInitScript(() => {
    localStorage.removeItem('poket-cookie-consent');
    localStorage.removeItem('poket-pip-onboarded');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test('the cookie banner and the Pip card fit at 390 and do not cover each other', async ({ page }) => {
  for (const path of ['/ai-teachers', '/']) {
    await fresh(page, path);
    const cookie = page.getByRole('dialog', { name: 'Cookie consent' });
    await expect(cookie).toBeVisible();
    inside(await cookie.boundingBox(), 390, 844);
    const pip = page.locator('[data-pip-card]');
    await expect(pip).toHaveCount(0);
    expect(await overlaps(cookie, pip)).toBe(false);

    await page.getByRole('button', { name: 'Reject optional' }).click();
    await expect(cookie).toHaveCount(0);
    if (path === '/ai-teachers') {
      await expect(pip).toBeVisible();
      inside(await pip.boundingBox(), 390, 844);
      const launcher = page.locator('[data-pip-launcher]');
      const launchBox = await launcher.boundingBox();
      inside(launchBox, 390, 844);
      expect(launchBox && launchBox.y + launchBox.height).toBeLessThan(120);
    } else {
      await expect(pip).toHaveCount(0);
    }
  }
});
