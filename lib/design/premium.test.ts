import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { premiumFill, premiumLightText } from './premium';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('premium light text is ink or blue, never the cyan fill', () => {
  assert.equal(premiumLightText.ink, '#203337');
  assert.equal(premiumLightText.blue, '#1E6A83');
  assert.equal(premiumFill.cyan, '#3FE0D0');
  assert.equal(new Set<string>(Object.values(premiumLightText)).has(premiumFill.cyan), false);
});

test('the landing does not paint cyan as text on a light surface', () => {
  const source = readFileSync(path.join(ROOT, 'components/landing/home-v3.tsx'), 'utf8');
  const offenders = source.split('\n').filter((line) => {
    if (!line.includes('text-[#3FE0D0]')) return false;
    return !line.includes('dark:text-[#3FE0D0]');
  });
  assert.deepEqual(offenders, []);
  assert.match(source, /data-landing="v3"/);
  assert.match(source, /data-landing-universities/);
  assert.match(source, /data-landing-aligned/);
  assert.match(source, /data-hero-stats/);
  assert.match(source, /data-hero-mock/);
  assert.equal(source.includes('#C8922A'), false);
  assert.equal(source.includes('text-amber-'), false);
});

test('premium motion respects reduced motion and leaves test scrolling native', () => {
  const source = readFileSync(path.join(ROOT, 'components/landing/use-premium-motion.ts'), 'utf8');
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /navigator\.webdriver/);
  assert.match(source, /ScrollTrigger/);
  assert.match(source, /data-hero-mock/);
  assert.match(source, /immediateRender: false/);
});
