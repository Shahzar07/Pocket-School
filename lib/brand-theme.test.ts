import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND, BRAND_GRADIENT, BRAND_PALETTE, brandPdfRgb } from './brand-theme';

test('TODO_BRAND is a blue gradient placeholder, not Rochford green or gold', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.equal(BRAND_PALETTE, 'TODO_BRAND');
  assert.match(css, /TODO_BRAND/);
  assert.match(css, /--brand-gradient:/);
  assert.equal(css.includes('--brand-forest'), false);
  assert.equal(css.includes('--brand-gold'), false);
  assert.equal(css.includes('#1A3C34'), false);
  assert.equal(css.includes('#C8922A'), false);
  for (const [name, hex] of Object.entries(BRAND)) {
    assert.match(css, new RegExp(`--brand-${name}: ${hex};`));
    assert.match(css, new RegExp(`--color-brand-${name}: var\\(--brand-${name}\\);`));
  }
  assert.equal(css.includes(BRAND_GRADIENT), true);
  assert.equal(brandPdfRgb(BRAND.ink), '0.043 0.227 0.431');
  assert.equal(brandPdfRgb(BRAND.mid), '0.106 0.435 0.878');
  assert.equal(brandPdfRgb(BRAND.bright), '0.298 0.608 1');
});
