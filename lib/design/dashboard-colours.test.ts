import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FAMILIES = 'red|rose|pink|orange|amber|yellow|purple|violet|fuchsia|indigo';
const PREFIX = '((?:[a-zA-Z0-9_-]+(?:\\[[^\\]]*\\])?:)*)';
const BANNED_CLASS = new RegExp(
  `(?<![\\w-])${PREFIX}(text|caret|decoration|placeholder|border(?:-[trblxy])?|divide|ring|outline|from|via|to|bg|fill|stroke|shadow|accent)-(${FAMILIES})-(\\d{2,3})(\\/\\d{1,3})?`,
);
const BANNED_DESTRUCTIVE = new RegExp(
  `(?<![\\w-])${PREFIX}(text|caret|decoration|placeholder|border(?:-[trblxy])?|divide|ring|outline|from|via|to|bg|fill|stroke|shadow|accent)-destructive(\\/\\d{1,3})?`,
);
const BANNED_TOKEN = /var\(--(?:ps-coral|ps-coral-soft|ps-coral-fill|ps-violet|destructive|chart-3|chart-4)\)/;
const BANNED_ACCENT = /accentForIndex\(|patternFill\(['"](?:coral|violet)['"]\)|tone=["'](?:coral|violet)["']|tone:\s*['"](?:coral|violet)['"]|id:\s*['"](?:coral|violet)['"]|\b(?:BRAND|light|dark)\.coral\b/;

const SKIP_DIR = new Set(['node_modules', 'ui', '.next']);

function hsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function channels(hex: string): [number, number, number] {
  let body = hex.replace('#', '');
  if (body.length === 3) body = body.split('').map(ch => ch + ch).join('');
  return [0, 2, 4].map(index => Number.parseInt(body.slice(index, index + 2), 16)) as [number, number, number];
}

/** Red, pink, orange, amber, gold, and purple. Green through blue stays. */
export function bannedDashboardHue(hex: string): boolean {
  const [r, g, b] = channels(hex);
  const { h, s } = hsl(r, g, b);
  if (s < 0.15) return false;
  return h < 70 || h >= 235;
}

function walk(dir: string, out: Set<string>) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) out.add(full);
  }
}

function resolveImport(spec: string, fromFile: string): string[] {
  let target: string | null = null;
  if (spec.startsWith('@/')) target = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) target = path.resolve(path.dirname(fromFile), spec);
  else return [];
  const candidates = [target, `${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts'), path.join(target, 'index.tsx')];
  return candidates.filter(file => existsSync(file) && statSync(file).isFile());
}

function included(file: string): boolean {
  const rel = path.relative(ROOT, file);
  if (rel.startsWith(`components${path.sep}ui${path.sep}`)) return false;
  if (rel === 'components/pip-guide.tsx') return false;
  if (rel.includes(`${path.sep}pip${path.sep}`) || rel.includes('pip-avatar')) return false;
  if (rel.startsWith(`lib${path.sep}`) && !rel.startsWith(`lib${path.sep}dashboard${path.sep}`)) return false;
  return rel.startsWith('components/') || rel.startsWith(`components${path.sep}`) || rel.startsWith('app/dashboard') || rel.startsWith(`app${path.sep}dashboard`) || rel.startsWith('lib/dashboard');
}

function dashboardSources(): string[] {
  const files = new Set<string>();
  for (const dir of [
    'app/dashboard',
    'components/dashboard',
    'components/admin',
    'components/shell',
    'components/progress',
    'components/insights',
    'components/goals',
    'components/career',
    'components/leaderboard',
    'components/study',
    'components/planner',
    'components/studio',
    'components/gamification',
    'lib/dashboard',
  ]) walk(path.join(ROOT, dir), files);
  for (const extra of ['components/dash-ui.tsx', 'components/notifications-bell.tsx', 'components/dashboard-search.tsx']) {
    files.add(path.join(ROOT, extra));
  }
  const queue = [...files];
  const seen = new Set(queue);
  while (queue.length) {
    const file = queue.pop();
    if (!file) break;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (!spec) continue;
      for (const next of resolveImport(spec, file)) {
        if (seen.has(next) || !included(next) || next.endsWith('.test.ts') || next.endsWith('.test.tsx')) continue;
        seen.add(next);
        files.add(next);
        queue.push(next);
      }
    }
  }
  return [...files];
}

test('banned dashboard hues fail and brand swatches pass', () => {
  for (const hex of ['#FDECEA', '#D0553F', '#C23B2E', '#6D28D9', '#C8820A', '#E88976', '#C4B5FD', '#9B1C1C', '#2C1C1A', '#FBECEA', '#5B3D8A']) {
    assert.equal(bannedDashboardHue(hex), true, hex);
  }
  for (const hex of ['#3FE0D0', '#1E6A83', '#E9F7FA', '#121E22', '#203337', '#0E7A62', '#6FBBCE', '#0F6E56', '#2786A4']) {
    assert.equal(bannedDashboardHue(hex), false, hex);
  }
  const [r, g, b] = [63, 224, 208].map((channel, index) => Math.round(channel * 0.18 + [255, 255, 255][index] * 0.82));
  const mixed = `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  assert.equal(bannedDashboardHue(mixed), false, `light tile wash on white ${mixed}`);
  const { h } = hsl(r ?? 0, g ?? 0, b ?? 0);
  assert.ok(h > 150 && h < 210, `light tile wash stays cyan, got ${h}`);
  const dark = channels('#121E22');
  const darkLightness = hsl(dark[0], dark[1], dark[2]).l;
  assert.ok(darkLightness < 0.25, 'dark tile is the dark surface');
  assert.equal(bannedDashboardHue('#121E22'), false);
});

test('dashboard sources do not paint banned hues', () => {
  const offenders: string[] = [];
  for (const file of dashboardSources()) {
    const rel = path.relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (BANNED_CLASS.test(line) || BANNED_DESTRUCTIVE.test(line) || BANNED_TOKEN.test(line) || BANNED_ACCENT.test(line)) {
        offenders.push(`${rel}:${index + 1}`);
      }
      BANNED_CLASS.lastIndex = 0;
      for (const match of line.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g)) {
        const body = match[1] ?? '';
        const hex = `#${body.length === 8 ? body.slice(0, 6) : body}`;
        if (bannedDashboardHue(hex)) offenders.push(`${rel}:${index + 1} ${match[0]}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});

test('admin desk tiles and urgent alerts use brand tokens', () => {
  const home = readFileSync(path.join(ROOT, 'lib/dashboard/home.ts'), 'utf8');
  assert.match(home, /safety:[\s\S]*wash: 'var\(--ps-tile-wash\)', ink: 'var\(--ps-tile-ink\)'/);
  assert.match(home, /people:[\s\S]*wash: 'var\(--ps-tile-wash\)', ink: 'var\(--ps-tile-ink\)'/);
  assert.match(home, /critical:[\s\S]*wash: 'var\(--ps-urgent-wash\)', ink: 'var\(--ps-urgent-ink\)'/);
  assert.doesNotMatch(home, /var\(--ps-coral|var\(--destructive\)/);
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  assert.match(css, /--ps-tile-wash:\s*rgba\(63,\s*224,\s*208,\s*0\.18\)/);
  assert.match(css, /--ps-tile-ink:\s*#1E6A83/i);
  assert.match(css, /--ps-urgent-wash:\s*#1E6A83/i);
  assert.match(css, /--ps-urgent-ink:\s*#FFFFFF/i);
  const dark = css.split('\n.dark {')[1] ?? '';
  assert.match(dark, /--ps-tile-wash:\s*#121E22/i);
  assert.match(dark, /--ps-tile-ink:\s*#3FE0D0/i);
  assert.match(dark, /--ps-urgent-wash:\s*#3FE0D0/i);
  assert.match(dark, /--ps-urgent-ink:\s*#203337/i);
});

test('Pip cheeks use a brand tint', () => {
  const pip = readFileSync(path.join(ROOT, 'components/pip-guide.tsx'), 'utf8');
  assert.match(pip, /fill="#3FE0D0"/);
  assert.doesNotMatch(pip, /#EC4899/);
});
