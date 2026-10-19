import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AI_TEACHERS } from './ai-teachers';
import { portraitFor, teacherPortrait } from './teacher-portrait';

test('every ET AI teacher has a distinct portrait', () => {
  const urls = AI_TEACHERS.map((teacher) => teacherPortrait(teacher));
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.endsWith('.svg')));
  assert.equal(portraitFor('Sciences', 'et-biology'), '/teachers/et-biology.svg');
  assert.notEqual(portraitFor('Sciences', 'et-biology'), portraitFor('Sciences', 'et-chemistry'));
});
