import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { TIMETABLE_COPY } from '../lib/timetable/copy';
import { pngWithText } from '../lib/timetable/paper';

const PAPER = 'Monday, P1, Maths, Primary 2, Ms Rahman, Room A';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png`, fullPage: true });
}

async function studioReady(page: Page) {
  await expect(page.locator('[data-studio-ready="1"]')).toBeVisible();
}

test('ET AI drafts an IGCSE week and waits for confirm', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeech {
      lang = 'en-GB';
      onresult: ((event: { results?: { 0?: { 0?: { transcript: string } } } }) => void) | null = null;
      start() {
        this.onresult?.({ results: { 0: { 0: { transcript: 'add 2 more maths periods for Primary 5' } } } });
      }
    }
    Object.assign(window, { SpeechRecognition: FakeSpeech, webkitSpeechRecognition: FakeSpeech });
  });
  await page.goto('/preview/studio?gate=school');
  await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
  await page.reload();
  await studioReady(page);
  await expect(page.locator('[data-studio-tab="timetable"]')).toBeVisible();
  await page.locator('[data-action="studio-quick"]').click();
  await expect(page.locator('[data-preview-diff="1"]')).toContainText('IGCSE');
  await expect(page.locator('[data-confirmable="1"]')).toBeVisible();
  await page.locator('[data-action="cancel-timetable"]').click();
  await expect(page.locator('[data-preview-diff="1"]')).toHaveCount(0);
  await page.locator('[data-action="studio-quick"]').click();
  await page.locator('[data-action="confirm-timetable"]').click();
  await expect(page.locator('[data-applied]')).not.toHaveAttribute('data-applied', '0');
  await shot(page, 'timetable-studio-chat');
  await page.locator('[data-studio-tab="timetable"]').click();
  await page.locator('[data-action="mic-timetable"]').click();
  await expect(page.locator('[data-preview-diff="1"]')).toContainText('Primary 5');
  await page.locator('[data-action="confirm-timetable"]').click();
  await page.locator('[data-action="timetable-text"]').fill('fix the room clashes on Tuesday');
  await page.locator('[data-action="timetable-text"]').press('Enter');
  await expect(page.locator('[data-notice="1"]')).toContainText('Tuesday');
  await page.locator('[data-action="timetable-text"]').fill('Ms Adeyemi is off tomorrow, find cover');
  await page.locator('[data-action="timetable-text"]').press('Enter');
  await expect(page.locator('[data-notice="1"]')).toContainText('Adeyemi');
  const gridHref = await page.locator('[data-action="open-grid"]').getAttribute('href');
  await page.goto(gridHref || '/preview/studio?view=editor&gate=school');
  await expect(page.locator('[data-studio-timetable="1"]')).toBeVisible();
  await expect(page.locator('[data-nested-frame="0"]')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('[aria-label="AI Studio"]')).toHaveCount(0);
  await shot(page, 'timetable-studio-grid');
});

test('a photographed timetable previews before it is saved', async ({ page }) => {
  writeFileSync('/tmp/paper-timetable.png', pngWithText(PAPER));
  await page.goto('/preview/studio?gate=school');
  await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
  await page.reload();
  await studioReady(page);
  await page.locator('[data-studio-tab="timetable"]').click();
  await page.locator('[data-action="photo-timetable"]').setInputFiles('/tmp/paper-timetable.png');
  await expect(page.locator('[data-preview-diff="1"]')).toContainText('Primary 2');
  await expect(page.locator('[data-confirmable="1"]')).toBeVisible();
  await shot(page, 'timetable-studio-photo');
  await page.locator('[data-action="confirm-timetable"]').click();
  await expect(page.locator('[data-notice="1"]')).toContainText(TIMETABLE_COPY.studioApplied);
});

test('the timetabler stays an upsell until the add-on is included', async ({ page }) => {
  await page.goto('/preview/studio?gate=upsell');
  await studioReady(page);
  await expect(page.locator('[data-studio-tab="timetable"]')).toBeVisible();
  await page.locator('[data-action="studio-quick"]').click();
  await expect(page.locator('[data-upsell="1"]')).toContainText(TIMETABLE_COPY.priceNote);
  await shot(page, 'timetable-studio-upsell');
  await page.goto('/preview/studio?view=editor&gate=upsell');
  await expect(page.locator('[data-nested-frame="0"]')).toBeVisible();
  await expect(page.locator('[data-action="generate"]')).toHaveCount(0);
  await page.goto('/preview/studio?gate=student');
  await expect(page.locator('[data-studio-tab="timetable"]')).toHaveCount(0);
});
