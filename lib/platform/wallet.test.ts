import assert from 'node:assert/strict';
import test from 'node:test';
import { readsPlanItem } from '@/lib/payments/reads';
import { normalizePricing } from '@/lib/pricing';
import { quoteCheckout } from './wallet';

test('converts a one-time book with the admin MYR rate and flags Touch ’n Go', () => {
  const quote = quoteCheckout({ kind: 'book', id: 'harbour-light', currency: 'MYR' });
  assert.ok(quote);
  assert.equal(quote.usd, 1.99);
  assert.equal(quote.amount, 9.99);
  assert.equal(quote.currency, 'MYR');
  assert.equal(quote.mode, 'payment');
  assert.deepEqual(quote.stripeMethods, ['card', 'fpx', 'grabpay']);
  assert.equal(quote.touchNGoRequested, true);
});

test('charges the published Reads prices', () => {
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads', interval: 'monthly' })?.amount, 4.99);
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads', interval: 'annual' })?.amount, 49.99);
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads-family', interval: 'monthly' })?.amount, 7.99);
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads-family', interval: 'annual' })?.amount, 79.99);
  assert.equal(quoteCheckout({ kind: 'book', id: 'harbour-light' })?.usd, 1.99);
});

test('a saved $9 / $15 shelf still checks out at the published prices', () => {
  const stored = normalizePricing({
    reads: [
      { id: 'reads', monthlyUsd: 9 },
      { id: 'reads-family', monthlyUsd: 15 },
    ],
    plans: [
      { id: 'reads', monthlyUsd: 9, annualUsd: 90, sparks: 0 },
      { id: 'reads-family', monthlyUsd: 15, annualUsd: 150, sparks: 0 },
    ],
  });
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads', interval: 'monthly' }, stored)?.amount, 4.99);
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads', interval: 'annual' }, stored)?.amount, 49.99);
  assert.equal(quoteCheckout({ kind: 'reads', id: 'reads-family', interval: 'annual' }, stored)?.amount, 79.99);
  assert.equal(readsPlanItem('reads', 'year', stored)?.unitAmount, 49.99);
  assert.equal(readsPlanItem('reads-family', 'month', stored)?.unitAmount, 7.99);
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
  assert.equal(quote.amount, 79.99);
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
  assert.equal(quoteCheckout({ kind: 'plan', id: 'primary_secondary', interval: 'monthly' }), null);
  const quote = quoteCheckout({ kind: 'plan', id: 'igcse_alevel', interval: 'monthly' });
  assert.equal(quote?.amount, 79);
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
