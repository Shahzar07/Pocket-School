import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const color = hex.replace('#', '');
  return 0.2126 * channel(color, 0) + 0.7152 * channel(color, 2) + 0.0722 * channel(color, 4);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing ${selector} block`);
  return match[1];
}

function decl(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(match, `missing ${name}`);
  return match[1].toUpperCase();
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts|css)$/.test(entry)) found.push(full);
  }
  return found;
}

test('light and dark primary tokens clear WCAG 4.5:1', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  const light = block(css, ':root');
  const dark = block(css, '.dark');
  const pricing = block(css, '.pricing-page');

  assert.equal(decl(light, '--primary'), '#1E6A83');
  assert.equal(decl(light, '--primary-foreground'), '#FFFFFF');
  assert.equal(decl(dark, '--primary'), '#6FBBCE');
  assert.equal(decl(dark, '--primary-foreground'), '#0B1417');
  assert.equal(decl(pricing, '--primary'), '#1E6A83');
  assert.equal(decl(pricing, '--primary-foreground'), '#FFFFFF');

  const pairs: Array<[string, string, string]> = [
    ['#1E6A83', '#FFFFFF', 'light primary on white'],
    ['#FFFFFF', '#1E6A83', 'white on light primary'],
    ['#6FBBCE', '#0B1417', 'dark primary on canvas'],
    ['#6FBBCE', '#121E22', 'dark primary on cards'],
    ['#0B1417', '#6FBBCE', 'dark text on dark primary'],
    ['#6FBBCE', '#203337', 'institution eyebrow'],
    ['#A9D7E4', '#203337', 'institution headline mid stop'],
    ['#3FE0D0', '#203337', 'institution headline cyan stop'],
  ];
  for (const [foreground, background, label] of pairs) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= 4.5, `${label} is ${ratio.toFixed(2)}:1`);
  }

  assert.ok(contrast('#2786A4', '#FFFFFF') < 4.5);
  assert.ok(contrast('#FFFFFF', '#6FBBCE') < 4.5);
  assert.ok(contrast('#1E6A83', '#203337') < 4.5);
});

test('pricing and dashboards do not hardcode the old primary', () => {
  const roots = ['app/pricing', 'app/dashboard', 'components'].map(dir => path.join(ROOT, dir));
  const offenders: string[] = [];
  for (const file of roots.flatMap(filesUnder)) {
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    if (/#2786A4/i.test(source) || /rgba\(\s*39\s*,\s*134\s*,\s*164/i.test(source)) {
      offenders.push(path.relative(ROOT, file));
    }
    for (const literal of source.match(/['"`][^'"`]*['"`]/g) ?? []) {
      const solidPrimary = /(?:^|\s)bg-primary(?:\s|$)/.test(literal);
      const whiteText = /(?:^|\s)text-white(?:\/|\s|$)/.test(literal);
      if (solidPrimary && whiteText) {
        offenders.push(`${path.relative(ROOT, file)} uses text-white on bg-primary`);
      }
    }
  }
  assert.deepEqual(offenders, []);

  const pricing = readFileSync(path.join(ROOT, 'app/pricing/page.tsx'), 'utf8');
  assert.match(pricing, /pricing-page/);
  assert.match(pricing, /from-\[#6FBBCE\] via-\[#A9D7E4\] to-\[#3FE0D0\]/);
  assert.doesNotMatch(pricing, /from-primary via-\[#6FBBCE\]/);

  const certificate = readFileSync(path.join(ROOT, 'lib/certificates.ts'), 'utf8');
  assert.match(certificate, /border: 2px solid #1E6A83/);
  assert.doesNotMatch(certificate, /var\(--primary\)/);
});

test('cyan tokens match the shared accent and keep weak pairs off text', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  const light = block(css, ':root');
  const dark = block(css, '.dark');

  assert.equal(decl(light, '--ps-cyan'), '#3FE0D0');
  assert.equal(decl(light, '--ps-cyan-strong'), '#14B8A6');
  assert.equal(decl(light, '--ps-cyan-text'), '#1E6A83');
  assert.equal(decl(light, '--ps-cyan-ink'), '#203337');
  assert.equal(decl(light, '--ps-cyan-border'), '#1E6A83');
  assert.match(light, /--ps-cyan-soft:\s*rgba\(63,\s*224,\s*208,\s*0\.15\)/);
  assert.match(light, /--ps-amber:\s*var\(--ps-cyan-text\)/);
  assert.match(light, /--ps-amber-fill:\s*var\(--ps-cyan\)/);

  assert.equal(decl(dark, '--ps-cyan'), '#3FE0D0');
  assert.equal(decl(dark, '--ps-cyan-strong'), '#14B8A6');
  assert.equal(decl(dark, '--ps-cyan-text'), '#3FE0D0');
  assert.equal(decl(dark, '--ps-cyan-ink'), '#203337');
  assert.equal(decl(dark, '--ps-cyan-border'), '#1E6A83');
  assert.match(dark, /--ps-amber:\s*var\(--ps-cyan-text\)/);
  assert.match(dark, /--ps-amber-fill:\s*var\(--ps-cyan\)/);

  const required: Array<[string, string, string]> = [
    ['#1E6A83', '#FFFFFF', 'cyan text on white'],
    ['#1E6A83', '#F4F6F6', 'cyan text on the page'],
    ['#203337', '#3FE0D0', 'ink on the cyan fill'],
    ['#203337', '#14B8A6', 'ink on the dark cyan fill'],
    ['#3FE0D0', '#0B1417', 'cyan accent on the dark canvas'],
    ['#3FE0D0', '#121E22', 'cyan accent on a dark card'],
    ['#3FE0D0', '#203337', 'cyan accent on institution ink'],
    ['#14B8A6', '#0B1417', 'cyan strong on the dark canvas'],
  ];
  for (const [foreground, background, label] of required) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= 4.5, `${label} is ${ratio.toFixed(2)}:1`);
  }

  const forbidden: Array<[string, string, string]> = [
    ['#14B8A6', '#FFFFFF', 'cyan strong on white'],
    ['#14B8A6', '#F4F6F6', 'cyan strong on the page'],
    ['#3FE0D0', '#FFFFFF', 'cyan fill on white'],
    ['#3FE0D0', '#F4F6F6', 'cyan fill on the page'],
    ['#1E6A83', '#3FE0D0', 'brand blue on the cyan fill'],
    ['#1E6A83', '#0B1417', 'brand blue on the dark canvas'],
  ];
  for (const [foreground, background, label] of forbidden) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio < 4.5, `${label} is ${ratio.toFixed(2)}:1 and must not be used for text`);
  }

  assert.doesNotMatch(css, /#0F766E/i);
  assert.doesNotMatch(css, /#E2AF4D/i);
  assert.doesNotMatch(css, /#9A5B00/i);
  assert.doesNotMatch(css, /#F9AB00/i);
});
