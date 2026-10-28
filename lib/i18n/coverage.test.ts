import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogs } from './catalog';
import { READS_EN } from '../reads/messages';

/**
 * Keys the interface actually reads. A complete key tree is not enough:
 * catalogs merge over English, so an untranslated leaf still type-checks.
 * landing-page.tsx is unused and its landing.* keys are out of this check.
 */
const SKIP = new Set(['components/landing/landing-page.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !name.includes('.test.')) out.push(path);
  }
  return out;
}

function usedKeys(): string[] {
  const keys = new Set<string>();
  const pattern = /(?:(?<![\w.])t|readsT)\(\s*['"]([a-zA-Z][\w]*\.[\w.]+)['"]|labelKey:\s*['"]([a-zA-Z][\w]*\.[\w.]+)['"]/g;
  const files = ['app', 'components', 'lib'].flatMap(dir => walk(dir));
  for (const file of files) {
    if (SKIP.has(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) keys.add(match[1] || match[2]);
  }
  return [...keys].sort();
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function leaves(value: unknown, prefix: string): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${prefix}.${index}`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

const PRODUCT_VALUES = new Set([
  'AI Studio',
  'ET AI',
  'ET Essays',
  'ET Exams',
  'ET Maths',
  'AI Teachers',
  'Poket SafeLine',
  'PoketReads',
  'Poket Reads',
  'Poket School',
  'ET AI Studio',
  'ET AI Timetabler',
  'Timetabler',
  'IGCSE',
  'A-Level',
  'Blog',
  'Aisha',
  'Imran',
  'Custom',
  'Law (LLB)',
  'Medicine (MBBS)',
  'Tukar ke Bahasa Melayu?',
  '{{count}} Sparks',
  '≈ {{amount}}',
  'Rochford’s International School',
]);

function allowlisted(key: string, value: string): boolean {
  if (key === 'footer.rights' || key === 'suggest.malay' || key === 'sparks.heading' || key === 'market.approx') return true;
  if (key.endsWith('.href') || key.endsWith('.amount')) return true;
  if (key.startsWith('home.v3.boards')) return true;
  if (PRODUCT_VALUES.has(value)) return true;
  if (/^\$[\d.,]+$/.test(value)) return true;
  return false;
}

function englishLeaf(key: string): string | undefined {
  const fromCatalog = readPath(catalogs.en, key);
  if (typeof fromCatalog === 'string') return fromCatalog;
  const fromReads = READS_EN[key as keyof typeof READS_EN];
  return typeof fromReads === 'string' ? fromReads : undefined;
}

test('human catalogs translate the keys the interface uses', () => {
  const keys = usedKeys();
  assert.ok(keys.includes('home.v3.teachersLabel'));
  assert.ok(keys.includes('signup.createTitle'));
  assert.ok(keys.includes('auth.line1'));
  const failures: string[] = [];
  for (const code of ['ms', 'zh', 'ta'] as const) {
    for (const key of keys) {
      const english = readPath(catalogs.en, key);
      const local = readPath(catalogs[code], key);
      const pairs = typeof english === 'string' || english == null
        ? [[key, englishLeaf(key), typeof local === 'string' ? local : undefined] as const]
        : leaves(english, key).map(([path, value]) => {
          const translated = readPath(catalogs[code], path);
          return [path, value, typeof translated === 'string' ? translated : undefined] as const;
        });
      for (const [path, source, translated] of pairs) {
        if (typeof source !== 'string') {
          failures.push(`${code} ${path} missing from English`);
          continue;
        }
        if (translated == null) {
          failures.push(`${code} ${path} missing`);
          continue;
        }
        if (translated === source && !allowlisted(path, source)) failures.push(`${code} ${path} = ${JSON.stringify(source)}`);
        for (const token of source.match(/\{\{\w+\}\}/g) ?? []) {
          if (!translated.includes(token)) failures.push(`${code} ${path} dropped ${token}`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('Malay sign-up heading does not repeat the classroom line', () => {
  assert.equal(catalogs.ms.auth.line1, 'Kelas paling pintar anda');
  assert.equal(catalogs.ms.auth.line1.toLowerCase().includes('bilik darjah'), false);
  assert.match(catalogs.ms.auth.line2, /Bilik darjah/);
  assert.equal(catalogs.zh.header.forSchools === catalogs.en.header.forSchools, false);
  assert.equal(catalogs.ta.header.programmes === catalogs.en.header.programmes, false);
  const home = catalogs as unknown as Record<string, { home: { v3: { teachersLabel: string; levelsLabel: string; priceTitle: string } } }>;
  assert.equal(home.zh.home.v3.teachersLabel.includes('ET AI'), true);
  assert.notEqual(home.zh.home.v3.levelsLabel, 'Primary to PhD');
  assert.notEqual(home.ta.home.v3.priceTitle, home.en.home.v3.priceTitle);
  assert.notEqual(home.ms.home.v3.teachersLabel, 'ET AI teachers');
});
