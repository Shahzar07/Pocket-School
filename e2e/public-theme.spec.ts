import { expect, test, type Page } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/demo',
  '/institutions',
  '/safeline',
  '/stand-up-to-bullying',
  '/id',
  '/studio',
  '/rochfords',
  '/primary',
  '/igcse',
  '/alevel',
  '/llb',
  '/mbbs',
  '/independent',
  '/privacy',
  '/terms',
  '/blog',
  '/pricing',
  '/courses',
  '/ai-teachers',
  '/community-partners',
  '/safety-terms',
  '/help',
  '/institutions/register',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const mode = window.name === 'e2e-dark' ? 'dark' : 'light';
    localStorage.setItem('theme', mode);
    localStorage.setItem('poket-pip-onboarded', '1');
    localStorage.setItem('poket-cookie-consent', JSON.stringify({
      essential: true, functional: false, analytics: false, aiPerformance: false, decidedAt: '2026-10-20T00:00:00.000Z',
    }));
  });
});

function nearWhite(color: string): boolean {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  return Number(match[1]) > 235 && Number(match[2]) > 235 && Number(match[3]) > 235;
}

async function settled(page: Page) {
  const shell = page.locator('[data-tool-shell="1"]');
  if (await shell.count() === 0) return;
  const dark = (await page.locator('html').getAttribute('class'))?.includes('dark') ?? false;
  await expect(shell).toHaveAttribute('data-studio-theme', dark ? 'dark' : 'light');
}

async function paint(page: Page) {
  return page.evaluate(() => {
    const opaque = (start: Element | null) => {
      let node = start;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match && (match[4] === undefined || Number(match[4]) > 0.6)) return bg;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const colors = [0.42, 0.68, 0.9].map((part) => {
      const target = Math.min(height - 8, Math.max(80, height * part));
      window.scrollTo(0, Math.max(0, target - 280));
      const hit = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.min(420, window.innerHeight - 24));
      return opaque(hit);
    });
    window.scrollTo(0, 0);
    return { body: getComputedStyle(document.body).backgroundColor, colors };
  });
}

async function toDark(page: Page) {
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' }).first();
  const visible = await toggle.isVisible().catch(() => false);
  if (visible) {
    // The control is in the server HTML before hydration. A click in that
    // gap does nothing, so keep clicking until the theme class lands.
    await expect(async () => {
      const klass = await page.locator('html').getAttribute('class');
      if (!klass?.includes('dark')) await toggle.click();
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    return;
  }
  // Some public doors hide the marketing header. The saved theme still
  // has to restyle the page, which is what a visitor gets after switching
  // on any other route.
  await page.evaluate(() => {
    window.name = 'e2e-dark';
    localStorage.setItem('theme', 'dark');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/dark/);
}

test('public pages change background when the theme switches', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of PUBLIC_ROUTES) {
    await page.evaluate(() => {
      window.name = '';
    }).catch(() => undefined);
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 0, route).toBeLessThan(400);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await settled(page);
    const light = await paint(page);
    await toDark(page);
    await settled(page);
    const dark = await paint(page);
    expect(light.body, `${route} body`).not.toBe(dark.body);
    const changed = light.colors.some((color, index) => color !== dark.colors[index]);
    expect(changed, `${route} ${light.colors.join(' | ')} -> ${dark.colors.join(' | ')}`).toBe(true);
    for (const color of dark.colors) expect(nearWhite(color), `${route} ${color}`).toBe(false);
  }
});

test('the mobile home header stays on one row', async ({ page }) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const header = page.locator('[data-site-header="flow"]');
    const headerBox = await header.boundingBox();
    expect(headerBox, String(width)).not.toBeNull();
    expect(headerBox!.height, String(width)).toBeLessThanOrEqual(80);
    const fit = await header.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(fit, String(width)).toBe(true);
    const eyebrow = page.getByText(/lifelong learning platform/i).first();
    const eye = await eyebrow.boundingBox();
    expect(eye, String(width)).not.toBeNull();
    expect(eye!.y, String(width)).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
    await expect(header.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Start for free' })).toBeVisible();
    const hero = page.locator('h1').first();
    const heroBox = await hero.boundingBox();
    expect(heroBox!.y, String(width)).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
  }
});
