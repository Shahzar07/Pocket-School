import { expect, test, type Page } from '@playwright/test';
import { GOOGLE_CALENDAR_COPY } from '../lib/google-calendar/copy';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `/opt/cursor/artifacts/screenshots/${name}.png`, fullPage: true });
}

test('the iCal download stays available when Google is not configured', async ({ page }) => {
  await page.goto('/preview/timetable?surface=institution');
  await expect(page.locator('[data-google-state="unconfigured"]')).toBeVisible();
  await expect(page.locator('[data-google-unconfigured="1"]')).toHaveText(GOOGLE_CALENDAR_COPY.notConfigured);
  await expect(page.locator('[data-action="google-sync"]')).toHaveText(GOOGLE_CALENDAR_COPY.sync);
  await page.locator('[data-tab="publish"]').click();
  const download = page.waitForEvent('download');
  await page.locator('[data-action="ical"]').click();
  expect((await download).suggestedFilename()).toContain('.ics');
  await shot(page, 'google-calendar-unconfigured');
});

test('sync uses stable ids against a mocked Google calendar', async ({ page }) => {
  let syncs = 0;
  const seen: string[][] = [];
  await page.route('https://accounts.google.com/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* google mocked */' }));
  await page.route('https://www.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/google-calendar/**', async route => {
    const url = route.request().url();
    if (url.includes('/status')) {
      return route.fulfill({
        json: {
          configured: true,
          signedIn: true,
          connected: true,
          clientId: 'test-client.apps.googleusercontent.com',
          calendarName: 'Poket School',
          toggles: { timetable: true, cover: true, exams: true, assignments: true, planner: true },
          freeBusyOptIn: false,
          absenceKeyword: 'leave',
          absenceCalendarId: '',
          lastSyncAt: null,
          lastError: null,
          feedUrl: null,
          workspace: null,
        },
      });
    }
    if (url.includes('/sync') && route.request().method() === 'POST') {
      syncs += 1;
      const body = route.request().postDataJSON() as { events?: { sourceId: string }[] };
      const ids = (body.events ?? []).map(event => event.sourceId).sort();
      seen.push(ids);
      return route.fulfill({
        json: {
          configured: true,
          synced: true,
          upserted: ids.length,
          deleted: syncs === 1 ? 0 : 0,
          calendar: 'Poket School',
        },
      });
    }
    if (url.includes('/feed')) {
      return route.fulfill({ json: { url: 'http://127.0.0.1:3465/api/calendar/ics/mocked-token' } });
    }
    if (url.includes('/disconnect')) {
      return route.fulfill({ json: { connected: false } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/preview/timetable?surface=institution');
  await page.evaluate(() => window.localStorage.removeItem('poket-timetable-v1'));
  await page.reload();
  await page.locator('[data-action="generate"]').click();
  await expect(page.locator('[data-google-state="connected"]')).toBeVisible();
  await page.locator('[data-action="google-sync"]').click();
  await expect(page.locator('[data-google-message="1"]')).toContainText(GOOGLE_CALENDAR_COPY.synced);
  await page.locator('[data-action="google-sync"]').click();
  await expect.poll(() => syncs).toBe(2);
  expect(seen[0]?.length).toBeGreaterThan(0);
  expect(seen[1]).toEqual(seen[0]);
  await page.locator('[data-action="google-regenerate"]').click();
  await expect(page.locator('[data-feed-url="1"]')).toContainText('/api/calendar/ics/');
  await shot(page, 'google-calendar-sync');
});
