import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunksForTranslation, contentCacheKey, displayedField, displayedFields, hashFields, parseModelFields } from './content-translation';

test('displayed copy prefers a cached translation and can show the original', () => {
  assert.equal(displayedField('Cells', 'Sel', false), 'Sel');
  assert.equal(displayedField('Cells', 'Sel', true), 'Cells');
  assert.equal(displayedField('Cells', '   ', false), 'Cells');
  assert.deepEqual(
    displayedFields({ title: 'Cells', description: 'Biology' }, { title: 'Sel', description: 'Biologi' }, false),
    { title: 'Sel', description: 'Biologi' },
  );
});

test('the cache key changes when the source changes', () => {
  const first = contentCacheKey('lesson:1', 'ar', { title: 'Cells', text: 'Body' });
  const second = contentCacheKey('lesson:1', 'ar', { title: 'Cells', text: 'Edited' });
  const same = contentCacheKey('lesson:1', 'ar', { text: 'Body', title: 'Cells' });
  assert.notEqual(first, second);
  assert.equal(first, same);
  assert.equal(hashFields({ title: 'A' }), hashFields({ title: 'A' }));
});

test('long lessons split on a paragraph and short text stays one chunk', () => {
  assert.deepEqual(chunksForTranslation('Short lesson.', 20), ['Short lesson.']);
  const text = `${'A'.repeat(12)}\n\n${'B'.repeat(12)}`;
  const parts = chunksForTranslation(text, 16);
  assert.ok(parts.length >= 2);
  assert.equal(parts.join(''), text);
});

test('model JSON keeps only the requested string fields', () => {
  const parsed = parseModelFields('```json\n{"title":"Sel","extra":1,"text":"  "}\n```', ['title', 'text']);
  assert.deepEqual(parsed, { title: 'Sel' });
  assert.equal(parseModelFields('not json', ['title']), null);
});
