import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { LEARNER_LEVELS, levelLabel, resolveLevel, sameLevel } from './levels';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('older stored levels still resolve, including postgraduate', () => {
  const cases: Array<[string, string]> = [
    ['Undergraduate', 'undergraduate'],
    ['Upper secondary', 'upper-secondary'],
    ['Upper Secondary', 'upper-secondary'],
    ['Independent', 'independent'],
    ['degree', 'undergraduate'],
    ['Degree', 'undergraduate'],
    ['Degree (Undergraduate)', 'undergraduate'],
    ['Lower secondary', 'lower-secondary'],
    ['IGCSE', 'igcse'],
    ['O Level', 'igcse'],
    ['GCSE', 'igcse'],
    ['A-Level', 'a-level'],
    ['A Level', 'a-level'],
    ['Pre-University', 'pre-university'],
    ['Foundation', 'pre-university'],
    ['Masters', 'masters'],
    ['postgraduate', 'masters'],
    ['PhD', 'phd'],
    ['doctoral', 'phd'],
    ['Professional', 'professional'],
    ['Primary', 'primary'],
    ['Secondary', 'lower-secondary'],
    ['University', 'undergraduate'],
    ['Independent learner', 'independent'],
    ['IGCSE / O Level', 'igcse'],
    ['Postgraduate: Masters', 'masters'],
    ['Postgraduate: PhD / Doctoral', 'phd'],
  ];
  for (const [stored, id] of cases) {
    assert.equal(resolveLevel(stored), id, stored);
    assert.equal(sameLevel(stored, id), true, stored);
  }
  assert.equal(levelLabel('degree'), 'Undergraduate (Degree)');
  assert.equal(levelLabel('Upper secondary'), 'Upper Secondary');
  assert.equal(levelLabel('Independent'), 'Independent learner');
  assert.equal(sameLevel('IGCSE', 'IGCSE / O Level'), true);
  assert.equal(sameLevel('Degree', 'Undergraduate (Degree)'), true);
  assert.equal(resolveLevel('not-a-level'), null);
  assert.equal(LEARNER_LEVELS.filter((level) => level.group === 'postgraduate').map((level) => level.id).join(','), 'masters,phd');
});

const LEVEL_WORDS = new Set([
  'Primary',
  'Lower Secondary',
  'Lower secondary',
  'Upper Secondary',
  'Upper secondary',
  'IGCSE',
  'A-Level',
  'Undergraduate',
  'Independent',
  'Pre-University',
  'Foundation',
  'Degree',
  'Professional',
  'Postgraduate',
]);

/** Programme-year vocabulary stays in these files. New dropdowns use lib/levels.ts. */
const ALLOW = new Set([
  'lib/levels.ts',
  'lib/example-courses.ts',
]);

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.next')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

test('learner level lists are not hard-coded outside the shared module', () => {
  const pattern = /\[(?:\s*(?:'[^'\n]*'|"[^"\n]*")\s*,?\s*){3,}\]/g;
  const offenders: string[] = [];
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of filesUnder(path.join(ROOT, dir))) {
      const relative = path.relative(ROOT, file);
      if (ALLOW.has(relative)) continue;
      const source = readFileSync(file, 'utf8');
      const matches = source.match(pattern) ?? [];
      for (const block of matches) {
        const words = [...block.matchAll(/'([^']*)'|"([^"]*)"/g)].map((hit) => hit[1] ?? hit[2] ?? '');
        const hits = words.filter((word) => LEVEL_WORDS.has(word));
        const distinct = new Set(hits);
        if (distinct.size >= 3 && distinct.size / Math.max(words.length, 1) >= 0.6) {
          offenders.push(`${relative}: ${[...distinct].join(', ')}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});
