import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTermName, parseTermFile, termsToLines } from './terms';

test('a term file keeps dated rows and drops a reversed range', () => {
  const rows = parseTermFile('Term 1,2026-01-06,2026-03-20\nBad,2026-05-01,2026-04-01\n# comment');
  assert.deepEqual(rows, [{ name: 'Term 1', from: '2026-01-06', to: '2026-03-20' }]);
  assert.equal(termsToLines(rows), 'Term 1: 2026-01-06 to 2026-03-20');
});

test('the next term number follows the lines already written', () => {
  assert.equal(nextTermName('Term 1: a\nTerm 2: b'), 'Term 3');
  assert.equal(nextTermName(''), 'Term 1');
});
