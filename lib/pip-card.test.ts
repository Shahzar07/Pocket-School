import assert from 'node:assert/strict';
import test from 'node:test';
import { placePipCard } from './pip-card';

test('the Pip card stays inside a 390px phone, including above the lesson docks', () => {
  const phone = placePipCard({ viewportWidth: 390, viewportHeight: 844, rect: null });
  assert.ok(phone.left >= 16, `left ${phone.left}`);
  assert.ok(phone.top >= 16, `top ${phone.top}`);
  assert.ok(phone.left + phone.width <= 390 - 16, `right ${phone.left + phone.width}`);
  assert.ok(phone.top + Math.min(320, phone.maxHeight) <= 844 - 16);

  const spotlight = placePipCard({
    viewportWidth: 390,
    viewportHeight: 844,
    rect: { top: 8, left: 300, width: 80, height: 40 },
  });
  assert.ok(spotlight.left + spotlight.width <= 374, `spotlight right ${spotlight.left + spotlight.width}`);

  const docked = placePipCard({
    viewportWidth: 390,
    viewportHeight: 844,
    rect: null,
    dockBottom: 120,
  });
  assert.ok(docked.top + Math.min(320, docked.maxHeight) <= 844 - 16 - 120);
});
