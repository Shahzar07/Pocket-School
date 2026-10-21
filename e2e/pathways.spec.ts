import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);
import { HOME } from '../lib/marketing/home';
import { pathwayBySlug } from '../lib/pathways/catalog';

async function dismissCookies(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cookie consent' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Accept all' }).click();
  }
}

async function openCard(page: Page, title: string, href: string) {
  await page.goto('/');
  await dismissCookies(page);
  const section = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Primary through degree foundation.' }),
  });
  const card = section.getByRole('link').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
}

for (const card of HOME.levels) {
  test(`${card.title} card opens stages and subjects`, async ({ page }) => {
    await openCard(page, card.title, card.href);
    const pathway = pathwayBySlug(card.href.replace(/^\//, ''));
    expect(pathway).toBeTruthy();
    await expect(page.locator('[data-pathway]')).toHaveAttribute('data-pathway', pathway!.slug);
    await expect(page.getByRole('navigation', { name: 'Stages' })).toBeVisible();
    await expect(page.locator('[data-pathway-stage]').first()).toBeVisible();
    const subject = pathway!.stages[0]?.subjects[0]?.name ?? '';
    await expect(page.locator('[data-pathway-subject]').filter({ hasText: subject }).first()).toBeVisible();
    await expect(page.locator('[data-pathway-price]')).toHaveAttribute('data-pathway-price', card.price);
    const stageLink = page.locator('[data-stage-nav] a').first();
    const hash = await stageLink.getAttribute('href');
    await stageLink.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(page.locator(hash ?? 'h1')).toBeVisible();
    const jsonLd = await page.locator('script[data-faq-jsonld="1"]').evaluate((node) => node.textContent ?? '');
    expect(jsonLd).toContain('FAQPage');
    await expect(page.getByRole('link', { name: 'Talk to us' })).toBeVisible();
  });
}

test('LLB page lists years, Contract Law, and ET Law', async ({ page }) => {
  await page.goto('/llb');
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'Year 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year 3' })).toBeVisible();
  await expect(page.getByText('Contract Law').first()).toBeVisible();
  await expect(page.getByText('Legal System and Method').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'ET Law' }).first()).toBeVisible();
  await expect(page.locator('[data-pathway-disclaimer="1"]')).toHaveText('Degree pathway. Not a university enrolment.');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/pathway-llb.png', fullPage: true });
  // The public header overflows at this width, so the theme control is off-screen.
  await page.getByRole('button', { name: 'Switch to dark mode' }).evaluate((node: HTMLButtonElement) => node.click());
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/pathway-llb-dark.png', fullPage: true });
});

test('IGCSE page lists subjects and boards', async ({ page }) => {
  await page.goto('/igcse');
  await dismissCookies(page);
  await expect(page.getByRole('heading', { name: 'IGCSE', exact: true }).first()).toBeVisible();
  await expect(page.getByText('English First Language').first()).toBeVisible();
  await expect(page.getByText('Mathematics').first()).toBeVisible();
  await expect(page.getByText('Biology').first()).toBeVisible();
  await expect(page.getByText('Pearson Edexcel').first()).toBeVisible();
  await expect(page.getByText('Poket School does not award those grades.').first()).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/pathway-igcse.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/pathway-igcse-mobile.png', fullPage: true });
});
