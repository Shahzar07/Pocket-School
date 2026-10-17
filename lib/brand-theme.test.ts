import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND, FONT, HERO_GRADIENT, RADIUS, brandPdfRgb } from './brand-theme';

test('confirmed brand tokens are the blue gradient, not Rochford green or gold', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./brand-theme.ts', import.meta.url), 'utf8');
  assert.equal(css.includes('TODO_BRAND'), false);
  assert.equal(source.includes('TODO_BRAND'), false);
  assert.equal(css.includes('--brand-forest'), false);
  assert.equal(css.includes('--brand-gold'), false);
  assert.equal(css.includes('#1A3C34'), false);
  assert.equal(css.includes('#C8922A'), false);
  assert.equal(css.includes('#0B3A6E'), false);
  assert.equal(css.includes('#1B6FE0'), false);
  const vars: Record<string, string> = {
    '--ink': BRAND.ink,
    '--blue-deep': BRAND.blueDeep,
    '--blue-bright': BRAND.blueBright,
    '--brand-primary': BRAND.primary,
    '--amber': BRAND.amber,
    '--coral': BRAND.coral,
    '--good': BRAND.good,
    '--bg': BRAND.bg,
    '--wash': BRAND.wash,
    '--line': BRAND.line,
    '--muted-ink': BRAND.muted,
    '--teacher': BRAND.teacher,
    '--parent': BRAND.parent,
    '--admin': BRAND.admin,
    '--hero-gradient': HERO_GRADIENT,
    '--radius-12': '12px',
    '--radius-18': '18px',
    '--radius-24': '24px',
    '--radius-32': '32px',
    '--radius-pill': '999px',
  };
  for (const [name, value] of Object.entries(vars)) {
    assert.equal(css.includes(`${name}: ${value};`), true, name);
  }
  assert.match(css, /--color-ink: var\(--ink\);/);
  assert.match(css, /--color-blue-deep: var\(--blue-deep\);/);
  assert.match(css, /--color-blue-bright: var\(--blue-bright\);/);
  assert.match(css, /--color-brand-primary: var\(--brand-primary\);/);
  assert.match(css, /--color-wash: var\(--wash\);/);
  assert.match(css, /--color-line: var\(--line\);/);
  assert.match(css, /\.bg-hero/);
  assert.equal(css.includes('--color-amber:'), false);
  assert.equal(css.includes('--color-coral:'), false);
  assert.equal(brandPdfRgb(BRAND.ink), '0.125 0.200 0.216');
  assert.equal(brandPdfRgb(BRAND.blueDeep), '0.118 0.416 0.514');
  assert.equal(brandPdfRgb(BRAND.primary), '0.153 0.525 0.643');
  assert.equal(brandPdfRgb(BRAND.blueBright), '0.435 0.733 0.808');
  assert.equal(FONT.sans, 'Plus Jakarta Sans');
  assert.equal(FONT.display, 'Instrument Sans');
  assert.deepEqual(RADIUS, { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 });
});
