import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryWhen, wrapSelection } from './compose';

test('markdown wraps the selection and an empty selection gets a placeholder', () => {
  assert.equal(wrapSelection('hello', 0, 5, '**', '**').text, '**hello**');
  assert.equal(wrapSelection('', 0, 0, '*', '*').text, '*text*');
});

test('a future schedule waits and a blank schedule sends now', () => {
  const now = Date.parse('2026-10-16T00:00:00Z');
  assert.equal(deliveryWhen('2026-10-17T00:00:00Z', now), 'later');
  assert.equal(deliveryWhen('', now), 'now');
  assert.equal(deliveryWhen('2026-10-15T00:00:00Z', now), 'now');
});
