import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND, brandPdfRgb } from './brand-theme';

test('the held palette is the only brand ink, and the stylesheet copies it', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  for (const [name, hex] of Object.entries(BRAND)) {
    assert.match(css, new RegExp(`--brand-${name}: ${hex};`));
    assert.match(css, new RegExp(`--color-brand-${name}: var\\(--brand-${name}\\);`));
  }
  assert.equal(brandPdfRgb(BRAND.forest), '0.102 0.235 0.204');
  assert.equal(brandPdfRgb(BRAND.blue), '0.235 0.553 1');
});
