import assert from 'node:assert/strict';
import test from 'node:test';
import { PAYMENT_PROVIDERS } from './payment-providers';

test('the payments page names every provider the owner asked for', () => {
  const ids = PAYMENT_PROVIDERS.map((provider) => provider.id);
  assert.deepEqual(ids, ['stripe', 'billplz', 'ipay88', 'rms', 'paypal', 'xendit']);
});
