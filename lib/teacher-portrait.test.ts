import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { AI_TEACHERS } from './ai-teachers';
import { portraitAlt, portraitFor, PORTRAIT_FILES, teacherPortrait } from './teacher-portrait';

test('every ET AI teacher has a distinct photographic portrait', () => {
  const urls = AI_TEACHERS.map((teacher) => teacherPortrait(teacher));
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.endsWith('.webp')));
  assert.ok(urls.every((url) => !url.endsWith('.svg')));
  assert.equal(portraitFor('Sciences', 'et-biology'), '/teachers/et-biology.webp');
  assert.notEqual(portraitFor('Sciences', 'et-biology'), portraitFor('Sciences', 'et-chemistry'));
  for (const url of urls) {
    assert.equal(existsSync(`public${url}`), true, url);
  }
  assert.equal(PORTRAIT_FILES.length, 36);
  assert.equal(portraitAlt('ET Biology'), 'ET Biology');
  assert.equal(portraitAlt('Mathematics'), 'ET Mathematics');
  assert.equal(portraitFor('Sciences', 'unknown-botany'), '/teachers/et-ai.webp');
});
