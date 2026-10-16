import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentCacheKey, displayedField, displayedFields, hashFields } from './content-translation';

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
