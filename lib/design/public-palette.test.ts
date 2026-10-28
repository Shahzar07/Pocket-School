import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Public marketing pages and the shared shell. Dashboard status colours
 * (absent, failed, recording) stay out of this scan.
 */
const ROOTS = [
  'app/ai-teachers',
  'app/pricing',
  'app/not-found.tsx',
  'app/page.tsx',
  'app/globals.css',
  'app/(auth)',
  'components/landing',
  'components/marketing',
  'components/pip-guide.tsx',
  'components/cookie-consent.tsx',
  'components/site-header.tsx',
  'components/site-footer.tsx',
  'components/ai-teacher-modal.tsx',
  'components/shell',
  'components/studio/tool-shell.tsx',
  'components/app-chrome.tsx',
  'components/site-chrome.tsx',
  'lib/ai-teachers.ts',
];

const FAMILIES = 'red|rose|pink|fuchsia|purple|violet|orange|amber|yellow|green|emerald|lime';
const BANNED_CLASS = new RegExp(
  `(?<![\\w-])(?:[a-zA-Z0-9_-]+(?:\\[[^\\]]*\\])?:)*(?:text|caret|decoration|placeholder|border(?:-[trblxy])?|divide|ring|outline|from|via|to|bg|fill|stroke|shadow|accent)-(?:${FAMILIES})-\\d{2,3}(?:\\/\\d{1,3})?`,
);
const BANNED_HEX = [
  '#EC4899', '#8B5CF6', '#10B981', '#1A73E8', '#1E3A8A', '#132A5E', '#F5F1FF', '#C8922A', '#E2AF4D',
];

/** Official Google "G". These hexes are allowed only inside the mark. */
const LOGO_ALLOW = [
  {
    file: 'components/institution-login-screen.tsx',
    hexes: ['#4285F4', '#34A853', '#FBBC05', '#EA4335'],
  },
];

function filesUnder(target: string): string[] {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return [target];
  const found: string[] = [];
  for (const entry of readdirSync(target)) {
    const full = path.join(target, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts|css)$/.test(entry) && !/\.test\.(tsx|ts)$/.test(entry)) found.push(full);
  }
  return found;
}

function allowedHex(rel: string, hex: string): boolean {
  const upper = hex.toUpperCase();
  return LOGO_ALLOW.some(item => item.file === rel && item.hexes.includes(upper));
}

test('public pages and the shared shell stay on the brand palette', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of filesUnder(path.join(ROOT, root))) {
      const rel = path.relative(ROOT, file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (BANNED_CLASS.test(line)) offenders.push(`${rel}:${index + 1} ${line.trim()}`);
        BANNED_CLASS.lastIndex = 0;
        for (const match of line.matchAll(/#([0-9a-fA-F]{6})/g)) {
          const hex = `#${(match[1] ?? '').toUpperCase()}`;
          if (BANNED_HEX.includes(hex) && !allowedHex(rel, hex)) offenders.push(`${rel}:${index + 1} ${hex}`);
        }
      });
    }
  }
  assert.deepEqual(offenders, []);
});

test('the Google mark is an explicit third-party exception', () => {
  const file = LOGO_ALLOW[0]?.file ?? '';
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  const start = source.indexOf('function GoogleMark');
  assert.ok(start > 0, 'GoogleMark');
  const mark = source.slice(start, start + 900);
  const hexes = [...mark.matchAll(/#([0-9a-fA-F]{6})/g)].map(match => `#${(match[1] ?? '').toUpperCase()}`);
  const brand = new Set(['#1E6A83', '#203337', '#2786A4', '#3FE0D0', '#6FBBCE', '#E7F4F2']);
  assert.ok(hexes.length >= 4);
  for (const hex of hexes) assert.ok(brand.has(hex) || LOGO_ALLOW[0]?.hexes.includes(hex), hex);
});
