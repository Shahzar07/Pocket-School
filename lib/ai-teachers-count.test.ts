import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AI_TEACHERS, teacherRosterCount, teacherShowingLine } from './ai-teachers';

test('the faculty count is the roster, not a 30+ floor', () => {
  const total = teacherRosterCount();
  assert.equal(total, AI_TEACHERS.length);
  assert.ok(total > 30);
  assert.equal(teacherShowingLine(total), `Showing ${total} of ${total}`);
  assert.equal(teacherShowingLine(1, total), `Showing 1 of ${total}`);
  assert.throws(() => teacherShowingLine(total + 1), /outside the roster/);
  const page = readFileSync(new URL('../app/ai-teachers/page.tsx', import.meta.url), 'utf8');
  assert.equal(page.includes('30+'), false);
  assert.match(page, /teacherRosterCount\(\)/);
  assert.match(page, /teacherShowingLine\(visible\.length\)/);
});
