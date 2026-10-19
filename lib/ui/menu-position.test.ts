import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuPosition } from './menu-position';

test('the account menu stays inside a narrow viewport', () => {
  const narrow = menuPosition({ left: -40, top: 20, bottom: 64 }, { width: 320, height: 700 });
  assert.ok(narrow.left >= 12);
  assert.ok(narrow.left + 288 <= 320 - 12);
  const wide = menuPosition({ left: 24, top: 20, bottom: 64 }, { width: 1280, height: 800 });
  assert.equal(wide.left, 24);
});
