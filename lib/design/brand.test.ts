import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { dark, font, hero, heroGradient, light, radius, ROCHFORD } from './tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts|css)$/.test(entry)) found.push(full);
  }
  return found;
}

test('light palette matches the confirmed Poket School brand', () => {
  assert.deepEqual(light, {
    bg: '#F4F6F6',
    wash: '#E9F7FA',
    mist: '#E9F7FA',
    card: '#FFFFFF',
    line: '#E7EDED',
    ink: '#203337',
    muted: '#5F7074',
    faint: '#8AA0A6',
    primary: '#2786A4',
    blueDeep: '#1E6A83',
    blueBright: '#6FBBCE',
    onPrimary: '#FFFFFF',
    cyan: '#3FE0D0',
    cyanStrong: '#14B8A6',
    cyanText: '#1E6A83',
    cyanSoft: 'rgba(63, 224, 208, 0.15)',
    cyanInk: '#203337',
    cyanBorder: '#1E6A83',
    coral: '#D0553F',
    coralSoft: '#FDECEA',
    good: '#1F8A70',
    mint: '#E5F6EF',
    mintInk: '#0E7A62',
    role: { teacher: '#E9F7FA', parent: '#E5F6EF', admin: '#F0F5F4' },
  });
});

test('dark palette matches the confirmed Poket School brand', () => {
  assert.deepEqual(dark, {
    bg: '#0B1417',
    wash: '#102028',
    mist: '#17282D',
    card: '#121E22',
    line: '#1E3238',
    ink: '#E8EFEF',
    muted: '#93A7AB',
    faint: '#6E848A',
    primary: '#6FBBCE',
    blueDeep: '#8ED0DE',
    blueBright: '#6FBBCE',
    onPrimary: '#0B1417',
    cyan: '#3FE0D0',
    cyanStrong: '#14B8A6',
    cyanText: '#3FE0D0',
    cyanSoft: 'rgba(63, 224, 208, 0.15)',
    cyanInk: '#203337',
    cyanBorder: '#1E6A83',
    coral: '#E88976',
    coralSoft: '#2C1C1A',
    good: '#8ED9C4',
    mint: '#142824',
    mintInk: '#8ED9C4',
    role: { teacher: '#121E22', parent: '#101C18', admin: '#10181E' },
  });
});

test('hero, radius, and brand fonts', () => {
  assert.equal(hero.angle, 135);
  assert.equal(
    heroGradient(hero.light),
    'linear-gradient(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%)',
  );
  assert.equal(
    heroGradient(hero.dark),
    'linear-gradient(135deg, #0B1417 0%, #17282D 50%, #1E6A83 100%)',
  );
  assert.deepEqual(radius, { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 });
  assert.equal(font.body, 'Plus Jakarta Sans');
  assert.equal(font.display, 'Instrument Sans');
});

test('Rochford school colours stay on the ROCHFORD constant', () => {
  assert.equal(ROCHFORD.forest, '#1A3C34');
  assert.equal(ROCHFORD.gold, '#C8922A');
  const offenders: string[] = [];
  for (const file of ['app', 'components'].flatMap(dir => filesUnder(path.join(ROOT, dir)))) {
    const source = readFileSync(file, 'utf8');
    if (/#1A3C34/i.test(source) || /#C8922A/i.test(source)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});

test('globals.css and the root layout publish the palette', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  assert.match(css, /--radius-sm:\s*12px/);
  assert.match(css, /--radius-md:\s*18px/);
  assert.match(css, /--radius-lg:\s*24px/);
  assert.match(css, /--radius-xl:\s*32px/);
  assert.match(css, /--radius-full:\s*999px/);
  assert.match(css, /--radius:\s*24px/);
  assert.match(css, /--muted-foreground:\s*#5F7074/i);
  assert.match(css, /--ps-hero:\s*linear-gradient\(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%\)/);
  assert.match(css, /--ps-hero:\s*linear-gradient\(135deg, #0B1417 0%, #17282D 50%, #1E6A83 100%\)/);
  assert.match(css, /--ps-role-parent:\s*#E5F6EF/i);
  assert.match(css, /--ps-role-parent:\s*#101C18/i);
  assert.doesNotMatch(css, /Instrument\+Serif/);
  assert.doesNotMatch(css, /#1A3C34/i);
  assert.doesNotMatch(css, /#C8922A/i);

  const layout = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
  assert.match(layout, /Plus_Jakarta_Sans/);
  assert.match(layout, /Instrument_Sans/);
  assert.doesNotMatch(layout, /Instrument_Serif/);
});
