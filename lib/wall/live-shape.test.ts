import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkWallImage, nestComments, wallHandle } from './live-shape';

test('wall photos are images under 5 MB', () => {
  assert.equal(checkWallImage({ type: 'image/png', size: 1000 }), '');
  assert.match(checkWallImage({ type: 'video/mp4', size: 1000 }), /image/);
  assert.match(checkWallImage({ type: 'image/jpeg', size: 5 * 1024 * 1024 }), /5 MB/);
});

test('comments thread under their parent', () => {
  const tree = nestComments([
    { id: 'a', authorId: 'u', authorHandle: 'amina', body: 'Hello', createdAt: 1, parentId: '' },
    { id: 'b', authorId: 'u', authorHandle: 'wei', body: 'Reply', createdAt: 2, parentId: 'a' },
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.replies[0]?.body, 'Reply');
});

test('a handle comes from the name', () => {
  assert.equal(wallHandle('Amina Rahman', 'uid123456'), 'amina-rahman');
});
