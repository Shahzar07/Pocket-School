import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the signup age message is blue on a light chip and readable in dark mode', () => {
  const source = readFileSync(path.join(ROOT, 'app/(auth)/signup/page.tsx'), 'utf8');
  const line = source.split('\n').find(row => row.includes("t('signup.tooYoung')")) ?? '';
  assert.match(line, /text-\[#1E6A83\]/);
  assert.match(line, /bg-\[#E9F7FA\]/);
  assert.match(line, /dark:text-\[#E7F4F2\]/);
  assert.equal(line.includes('text-[#3FE0D0]'), false);
});

test('the landing feature checks are not cyan on the light card', () => {
  const source = readFileSync(path.join(ROOT, 'components/landing/home-v3.tsx'), 'utf8');
  const line = source.split('\n').find(row => row.includes('<Check')) ?? '';
  assert.match(line, /text-\[#1E6A83\]/);
  assert.match(line, /dark:text-\[#3FE0D0\]/);
  assert.equal(/(?<![:\w-])text-\[#3FE0D0\]/.test(line), false);
});
