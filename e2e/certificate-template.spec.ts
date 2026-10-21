import { expect, test } from '@playwright/test';

test('the certificate designer shows one form and one sheet', async ({ page }) => {
  await page.goto('/preview/admin-tools?view=certificates');
  await expect(page.getByRole('heading', { name: 'Certificates' })).toBeVisible();
  await expect(page.locator('[data-certificate-form="1"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save template' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add template' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'New template' })).toHaveCount(0);
  await expect(page.locator('[data-certificate-sheet="1"]')).toHaveCount(1);
  await expect(page.locator('[data-certificate-sample="1"]')).toContainText('Template sample');
  await expect(page.locator('[data-certificate-sheet="1"]')).toContainText('With Harbour');
  await expect(page.getByLabel('Co-brand name')).toHaveValue('');
  await expect(page.locator('[data-certificate-footer="1"]')).toHaveCount(1);
  await expect(page.getByLabel('Page size')).toHaveValue('a4-landscape');
  const sheet = page.locator('[data-certificate-sheet="1"]');
  const box = await sheet.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width / box!.height).toBeGreaterThan(1.3);
  expect(box!.width / box!.height).toBeLessThan(1.55);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.getByLabel('Page size').selectOption('a4-portrait');
  const portrait = await sheet.boundingBox();
  expect(portrait!.height).toBeGreaterThan(portrait!.width);
  await page.getByLabel('Page size').selectOption('letter');
  const letter = await sheet.boundingBox();
  expect(letter!.width).toBeGreaterThan(letter!.height);

  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByRole('status')).toContainText('does not write a template');
  await page.getByLabel('Template name').fill('Harbour cyan');
  await expect(page.getByRole('tab', { name: /Harbour cyan/ })).toBeVisible();
  await page.getByLabel('Default template').uncheck();
  await expect(page.getByRole('tab', { name: 'Harbour cyan', exact: true })).toBeVisible();
  const logo = page.getByRole('textbox', { name: 'Institution logo URL' });
  await logo.fill('http://example.com/logo.png');
  await expect(page.getByRole('alert').first()).toContainText('https://');
  await logo.fill('');
  await page.getByLabel('Institution logo URL file').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Remove upload' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove upload' }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByRole('tab', { name: /Copy of Harbour cyan/ })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Delete template' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('tab', { name: /Copy of Harbour cyan/ })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Delete template' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('tab', { name: /Copy of Harbour cyan/ })).toHaveCount(0);
});

test('the preview sits under the form on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/admin-tools?view=certificates');
  const form = await page.locator('[data-certificate-form="1"]').boundingBox();
  const preview = await page.locator('[data-certificate-preview="1"]').boundingBox();
  expect(form && preview).toBeTruthy();
  expect(preview!.y).toBeGreaterThan(form!.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test('the template sample verify link resolves', async ({ page }) => {
  await page.goto('/verify/PS-1042');
  await expect(page.getByRole('heading', { name: 'Verify a certificate' })).toBeVisible();
  await expect(page.getByText('not a student award')).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'PS-1042' })).toBeVisible();
  await expect(page.getByText('Amina Yusuf').first()).toBeVisible();
  await expect(page.getByText('IGCSE Mathematics').first()).toBeVisible();
  await expect(page.getByText('has completed the module')).toHaveCount(0);
});
