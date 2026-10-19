import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_SETUP_MESSAGE, deskGate } from './desk-gate';

test('anonymous admin desk callers are rejected before any stub', () => {
  const gate = deskGate({ authenticated: false, admin: false, configured: false });
  assert.equal(gate.status, 401);
  assert.equal('kpis' in gate.body, false);
});

test('a signed-in admin without the server account sees setup needed, not zeros', () => {
  const gate = deskGate({ authenticated: true, admin: true, configured: false });
  assert.equal(gate.status, 200);
  if (gate.status !== 200 || !('setupNeeded' in gate.body)) throw new Error('expected setup');
  assert.equal(gate.body.message, ADMIN_SETUP_MESSAGE);
  assert.equal('kpis' in gate.body, false);
});

test('a configured admin desk proceeds to live data', () => {
  const gate = deskGate({ authenticated: true, admin: true, configured: true });
  assert.deepEqual(gate.body, { configured: true });
});
