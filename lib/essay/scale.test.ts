import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeFromMark } from './scale';

test('essay marks map onto 9–1 and U', () => {
  assert.deepEqual(gradeFromMark(95), { mark: 95, level: 9, letter: 'A*' });
  assert.deepEqual(gradeFromMark(80), { mark: 80, level: 8, letter: 'A*' });
  assert.deepEqual(gradeFromMark(74), { mark: 74, level: 7, letter: 'A' });
  assert.deepEqual(gradeFromMark(61), { mark: 61, level: 6, letter: 'B' });
  assert.deepEqual(gradeFromMark(55), { mark: 55, level: 5, letter: 'C' });
  assert.deepEqual(gradeFromMark(40), { mark: 40, level: 4, letter: 'C' });
  assert.deepEqual(gradeFromMark(33), { mark: 33, level: 3, letter: 'D' });
  assert.deepEqual(gradeFromMark(20), { mark: 20, level: 2, letter: 'E' });
  assert.deepEqual(gradeFromMark(12), { mark: 12, level: 1, letter: 'F' });
  assert.deepEqual(gradeFromMark(4), { mark: 4, level: 'U', letter: 'U' });
  assert.equal(gradeFromMark(140).mark, 100);
  assert.equal(gradeFromMark(Number.NaN).letter, 'U');
});
