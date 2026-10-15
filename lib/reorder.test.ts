import assert from 'node:assert/strict';
import test from 'node:test';
import { moveItem, popUndo, pushUndo, reorderById, sortByOrder, withSequentialOrder } from './reorder';

test('a move keeps the item and lands on the requested index', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(reorderById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'c', 'a').map(item => item.id), ['c', 'a', 'b']);
  assert.deepEqual(withSequentialOrder(['a', 'b']).map(item => item.order), [1, 2]);
});

test('missing order sorts after an explicit order, and undo restores the previous list', () => {
  const sorted = sortByOrder([
    { id: 'b', order: 2, title: 'B' },
    { id: 'a', title: 'A' },
    { id: 'c', order: 1, title: 'C' },
  ]);
  assert.deepEqual(sorted.map(item => item.id), ['c', 'b', 'a']);
  const stack = pushUndo([], { label: 'Move lesson', snapshot: ['a', 'b'] });
  const undone = popUndo(stack);
  assert.equal(undone.entry?.label, 'Move lesson');
  assert.deepEqual(undone.entry?.snapshot, ['a', 'b']);
  assert.equal(popUndo(undone.stack).entry, null);
});
