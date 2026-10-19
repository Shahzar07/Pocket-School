import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COPYRIGHT_DECLARATION, copyrightReady, copyrightRecord } from './copyright';

test('a publish declaration records who accepted it', () => {
  const record = copyrightRecord('teacher-1', 50);
  assert.equal(record.accepted, true);
  assert.equal(record.uid, 'teacher-1');
  assert.equal(record.at, 50);
  assert.match(record.text, /liable/);
  assert.equal(COPYRIGHT_DECLARATION.includes('Poket School'), true);
  assert.equal(copyrightReady(record), true);
  assert.equal(copyrightReady(null), false);
});
