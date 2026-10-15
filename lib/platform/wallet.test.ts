import { describe, expect, it } from 'vitest';
import { quoteCheckout } from './wallet';

describe('wallet checkout', () => {
  it('offers FPX and GrabPay on a one-time MYR book, and flags Touch ’n Go', () => {
    const quote = quoteCheckout({ kind: 'book', id: 'harbour-light', currency: 'MYR' });
    expect(quote).toMatchObject({
      amount: 5,
      currency: 'MYR',
      mode: 'payment',
      stripeMethods: ['card', 'fpx', 'grabpay'],
      touchNGoRequested: true,
    });
  });

  it('keeps Reads subscriptions on card, in USD', () => {
    const quote = quoteCheckout({
      kind: 'reads',
      id: 'reads-family',
      interval: 'annual',
      currency: 'MYR',
      methods: ['card', 'fpx', 'grabpay', 'touchngo'],
    });
    expect(quote).toMatchObject({
      amount: 150,
      currency: 'USD',
      mode: 'subscription',
      stripeMethods: ['card'],
      touchNGoRequested: false,
      recurring: 'year',
    });
  });

  it('refuses an unknown Reads plan', () => {
    expect(quoteCheckout({ kind: 'reads', id: 'reads-platinum' })).toBeNull();
  });

  it('prices a named school plan from the tier table', () => {
    const quote = quoteCheckout({ kind: 'plan', id: 'primary_secondary', interval: 'monthly' });
    expect(quote?.amount).toBe(49);
    expect(quote?.mode).toBe('subscription');
  });
});
