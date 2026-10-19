import { expect, test, type Page } from '@playwright/test';
import { TIMETABLE_COPY } from '../lib/timetable/copy';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png`, fullPage: true });
}

test('admin generates, fixes a clash, and approves cover', async ({ page }) => {
  await page.goto('/preview/timetable?surface=institution');
  await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
  await page.reload();
  await expect(page.locator('[data-timetable="institution"]')).toBeVisible();
  await page.locator('[data-action="generate"]').click();
  await expect(page.locator('[data-quality]')).toBeVisible();
  await expect(page.locator('[data-lesson]').first()).toBeVisible();
  await shot(page, 'timetable-built');
  await expect(page.locator('[data-clash-panel="1"]')).toContainText(TIMETABLE_COPY.noClash);
  const first = page.locator('[data-lesson]').first();
  await first.click();
  const teacher = await first.getAttribute('data-teacher');
  const slot = await first.getAttribute('data-slot');
  await page.locator(`[data-lesson][data-teacher="${teacher}"]:not([data-slot="${slot}"])`).first().click();
  await expect(page.locator('[data-blocked="1"]')).toBeVisible();
  await shot(page, 'timetable-clash');
  await page.locator('[data-action="fix"]').click();
  await expect(page.locator('[data-blocked="1"]')).toHaveCount(0);
  await page.locator('[data-tab="cover"]').click();
  await page.locator('[data-cover="1"] select').nth(1).selectOption('absent');
  for (const date of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) {
    await page.locator('[data-cover="1"] input').fill(date);
    await page.locator('[data-action="propose-cover"]').click();
    const count = await page.locator('[data-proposals]').getAttribute('data-proposals');
    if (count && count !== '0') break;
  }
  await expect(page.locator('[data-proposals]')).not.toHaveAttribute('data-proposals', '0');
  await shot(page, 'timetable-cover');
  await page.locator('[data-action="approve-cover"]').click();
  await expect(page.locator('[data-notices]')).not.toHaveAttribute('data-notices', '0');
});

test('a student picks options and the school creates sets', async ({ page }) => {
  await page.goto('/preview/timetable?surface=student');
  await expect(page.locator('[data-timetable="student"]')).toBeVisible();
  await page.locator('[data-tab="options"]').click();
  await page.locator('[data-options="1"] input[type="radio"]').first().check();
  await page.locator('[data-action="save-choice"]').click();
  await expect(page.locator('[data-notice="1"]')).toContainText('choice');
  await shot(page, 'timetable-student-options');
  await page.goto('/preview/timetable?surface=institution');
  await page.locator('[data-tab="options"]').click();
  await page.locator('[data-action="approve-options"]').click();
  await expect(page.locator('[data-sets="1"]')).toContainText('IGCSE');
});

test('teacher and parent see their own week', async ({ page }) => {
  await page.goto('/preview/timetable?surface=institution');
  await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
  await page.reload();
  await page.locator('[data-action="generate"]').click();
  await page.locator('[data-tab="publish"]').click();
  await page.locator('[data-action="publish"]').click();
  await expect(page.locator('[data-feed="1"]')).toContainText(TIMETABLE_COPY.registers);
  await shot(page, 'timetable-published');
  await page.goto('/preview/timetable?surface=teacher');
  await expect(page.locator('[data-timetable="teacher"]')).toBeVisible();
  await expect(page.locator('[data-lesson]').first()).toBeVisible();
  await shot(page, 'timetable-teacher');
  await page.goto('/preview/timetable?surface=parent');
  await expect(page.locator('[data-timetable="parent"]')).toBeVisible();
  await expect(page.locator('[data-lesson]').first()).toBeVisible();
  await shot(page, 'timetable-parent');
  await page.goto('/preview/timetable?surface=personal');
  await page.locator('[data-action="generate"]').click();
  await expect(page.locator('[data-quality]')).toBeVisible();
  await shot(page, 'timetable-personal');
});

test('the timetabler price stays TBC', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('TBC by Harry').first()).toBeVisible();
});
