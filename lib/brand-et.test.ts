import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Teacher names stay "ET" plus the subject. The AI brand on its own is "ET AI". */
const TEACHER = String.raw`Maths|Further|Additional|Science|Biology|Chemistry|Physics|Human|Medicine|Computer|ICT|English|Malay|Mandarin|French|German|Russian|Languages|Law|Global|Psychology|Sociology|Media|Business|Economics|Accounting|History|Geography|Art|Music|Exam|Study`;
const STANDALONE = new RegExp(String.raw`\bET\b(?!\s+AI\b)(?!\s+(?:${TEACHER})\b)`, 'g');

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(tsx|ts)$/.test(entry)) found.push(full);
  }
  return found;
}

test('dashboard copy uses ET AI for the brand and keeps ET subject names', () => {
  const offenders: string[] = [];
  for (const file of filesUnder(path.join(ROOT, 'app/dashboard'))) {
    const hits = readFileSync(file, 'utf8').match(STANDALONE);
    if (hits) offenders.push(`${path.relative(ROOT, file)}: ${hits.join(', ')}`);
  }
  assert.deepEqual(offenders, []);

  const studio = readFileSync(path.join(ROOT, 'app/dashboard/studio/page.tsx'), 'utf8');
  assert.match(studio, /name: 'ET AI'/);
  assert.match(studio, /name: 'ET Maths'/);
  assert.match(studio, /ET AI's tools/);
});
