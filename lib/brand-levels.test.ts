import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { NAMED_LEVELS } from './example-courses';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** School year numbers in copy. A four-digit year such as 2026 does not match. */
const YEAR_NUMBER = /\bYear\s+[0-9]{1,2}\b/;

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

test('user-facing copy uses named levels instead of Year 1 to Year 13', () => {
  const offenders: string[] = [];
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of filesUnder(path.join(ROOT, dir))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (YEAR_NUMBER.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
  assert.deepEqual(offenders, []);
});

test('the shared level list covers school, degree and professional work', () => {
  assert.deepEqual([...NAMED_LEVELS], [
    'Primary',
    'Lower Secondary',
    'IGCSE',
    'A-Level',
    'Pre-University',
    'Foundation',
    'Degree',
    'Professional',
  ]);
});
