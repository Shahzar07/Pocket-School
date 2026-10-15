import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteCheckout } from './wallet';

test('converts a one-time book with the admin MYR rate and flags Touch ’n Go', () => {
  const quote = quoteCheckout({ kind: 'book', id: 'harbour-light', currency: 'MYR' });
  assert.ok(quote);
  assert.equal(quote.usd, 5);
  assert.equal(quote.amount, 23.99);
  assert.equal(quote.currency, 'MYR');
  assert.equal(quote.mode, 'payment');
  assert.deepEqual(quote.stripeMethods, ['card', 'fpx', 'grabpay']);
  assert.equal(quote.touchNGoRequested, true);
});

test('keeps Reads subscriptions on card, in USD', () => {
  const quote = quoteCheckout({
    kind: 'reads',
    id: 'reads-family',
    interval: 'annual',
    currency: 'MYR',
    methods: ['card', 'fpx', 'grabpay', 'touchngo'],
  });
  assert.ok(quote);
  assert.equal(quote.amount, 150);
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.mode, 'subscription');
  assert.deepEqual(quote.stripeMethods, ['card']);
  assert.equal(quote.touchNGoRequested, false);
  assert.equal(quote.recurring, 'year');
});

test('refuses an unknown Reads plan', () => {
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads-platinum' }), null);
});

test('prices a named school plan from the admin pricing table', () => {
  const quote = quoteCheckout({ kind: 'plan', id: 'primary_secondary', interval: 'monthly' });
  assert.equal(quote?.amount, 19);
  assert.equal(quote?.currency, 'USD');
  assert.equal(quote?.mode, 'subscription');
});

test('prices an add-on from the admin pricing table', () => {
  const quote = quoteCheckout({ kind: 'addon', id: 'cms' });
  assert.equal(quote?.amount, 29);
  assert.equal(quote?.currency, 'USD');
  assert.equal(quote?.mode, 'subscription');
  assert.equal(quote?.recurring, 'month');
});
