import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  '/studio',
  '/safeline',
  '/id',
  '/demo',
  '/institutions',
  '/about',
  '/rochfords',
  '/primary',
  '/igcse',
  '/alevel',
  '/llb',
  '/mbbs',
  '/independent',
  '/ai-teachers',
  '/offer',
  '/stand-up-to-bullying',
];

async function ready(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
}

async function layout(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const art = page.locator('[data-market-art]');
  await expect(art).toBeVisible();
  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toBeVisible();
  const boxes = await Promise.all([
    art.boundingBox(),
    heading.boundingBox(),
  ]);
  const artBox = boxes[0];
  const headingBox = boxes[1];
  expect(artBox).toBeTruthy();
  expect(headingBox).toBeTruthy();
  if (!artBox || !headingBox) return;
  if (width < 1024) {
    expect(artBox.y).toBeLessThan(headingBox.y);
  } else {
    expect(artBox.x).toBeGreaterThan(headingBox.x);
  }
  const overflow = await art.evaluate((el) => Math.ceil(el.scrollWidth - el.clientWidth));
  expect(overflow).toBeLessThanOrEqual(1);
  const hero = page.locator('[data-market-hero="1"]');
  const heroOverflow = await hero.evaluate((el) => Math.ceil(el.scrollWidth - el.clientWidth));
  expect(heroOverflow).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(art).toBeVisible();
  const darkOverflow = await art.evaluate((el) => Math.ceil(el.scrollWidth - el.clientWidth));
  expect(darkOverflow).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

test('landing ET AI teachers card covers the full range', async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('a[href="/ai-teachers"]').filter({ has: page.getByRole('heading', { name: 'ET AI teachers', exact: true }) });
  await expect(card).toContainText('Primary to A-Levels');
  await expect(card).toContainText('Masters and PhD');
  await expect(card).toContainText('continuous professional development and independent learning');
  await expect(card).toContainText('The count on this page is the list in the product.');
  await expect(card).not.toContainText('degree foundation');
});

for (const path of PAGES) {
  test(`${path} shows a hero illustration without overflow`, async ({ page }) => {
    await ready(page);
    await layout(page, path, 1280);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(page.locator('[data-market-art]')).toBeVisible();
    await layout(page, path, 390);
    if (path === '/id') {
      const label = await page.locator('[data-market-art] title').textContent();
      expect(label).toContain('Sample');
    }
  });
}
