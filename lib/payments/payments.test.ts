import { describe, expect, it } from 'vitest';
import { isFlagEnabled, resolveFlags } from './flags';
import { SPARK_PACKS, subscriptionItem, walletTopUpItem } from './catalog';
import { commissionMinor, couponRejection, discountMinor, referralCode, type Coupon } from './coupons';
import { summariseFinance, reconcile } from './finance';
import { planGrants, planReversal, teacherPayoutMajor } from './fulfillment';
import { verifyGatewayNotice } from './gateway-notice';
import { claimDecision } from './idempotency';
import { canonicalMethod, methodsFor, stripeTypesForCharge, walletChargeMethod } from './methods';
import { buildQuote, QuoteError } from './quote';
import { harrySetup, isPlaceholder, maskSecret, missingRequired, describeSecret, SECRET_SLOTS } from './secrets';
import { billplzSignature, ipay88Amount, ipay88Signature, rmsSignature } from './signatures';
import { parseStripeEvent } from './stripe-events';
import { buildMyInvois, taxRateFor } from './tax';
import { readsBookItem, readsPlanItem } from './reads';
import { gatewayMode, stripeMode } from './providers';

const coupon: Coupon = {
  code: 'HARRY10',
  percentOff: 10,
  affiliateId: 'aff_1',
  revenueShareBps: 1000,
  active: true,
  redemptions: 0,
};

describe('payment methods follow country, currency and flags', () => {
  it('offers cards and wallets in the US for dollars, and hides Malaysian methods', () => {
    const ids = methodsFor({ country: 'US', currency: 'USD' }).map((method) => method.id);
    expect(ids).toContain('card');
    expect(ids).toContain('apple_pay');
    expect(ids).toContain('google_pay');
    expect(ids).toContain('wallet');
    expect(ids).not.toContain('fpx');
    expect(ids).not.toContain('tng');
  });

  it('offers FPX, GrabPay and the local wallets for a Malaysian ringgit charge', () => {
    const ids = methodsFor({ country: 'MY', currency: 'MYR' }).map((method) => method.id);
    expect(ids).toEqual(expect.arrayContaining(['card', 'fpx', 'grabpay', 'tng', 'boost', 'shopeepay', 'duitnow_qr']));
    expect(canonicalMethod("Touch 'n Go")).toBe('tng');
    expect(canonicalMethod('touchngo')).toBe('tng');
    expect(stripeTypesForCharge('card', 'MYR', 'book')).toEqual(['card', 'fpx', 'grabpay']);
    expect(stripeTypesForCharge('fpx', 'MYR', 'book')).toEqual(['fpx']);
    expect(stripeTypesForCharge('card', 'MYR', 'reads')).toEqual(['card']);
    expect(stripeTypesForCharge('card', 'USD', 'book')).toEqual(['card']);
    expect(walletChargeMethod('book', ['card', 'fpx', 'grabpay', 'touchngo'])).toBe('card');
    expect(walletChargeMethod('book', ['touchngo'])).toBe('tng');
    expect(walletChargeMethod('book', undefined, 'touchngo')).toBe('tng');
    expect(walletChargeMethod('reads', ['touchngo'])).toBe('card');
  });

  it('hides the Malaysian gateway when its flag is off', () => {
    const ids = methodsFor({
      country: 'MY',
      currency: 'MYR',
      overrides: { 'payments.my_gateway': false },
    }).map((method) => method.id);
    expect(ids).not.toContain('tng');
    expect(ids).toContain('fpx');
  });

  it('lets the environment force a flag off', () => {
    expect(isFlagEnabled('payments.stripe', null, '!payments.stripe')).toBe(false);
    expect(resolveFlags(null, 'payments.myinvois')['payments.myinvois']).toBe(true);
  });
});

describe('quotes, family seats, SST and affiliates', () => {
  it('prices a family plan at full price plus half for each sibling', () => {
    const item = subscriptionItem('igcse_alevel', 'month');
    expect(item?.unitAmount).toBe(79);
    const quote = buildQuote({ item: item!, seats: 3, country: 'US' });
    expect(quote.subtotal).toBe(79 + 39.5 + 39.5);
    expect(quote.tax).toBe(0);
    expect(quote.total).toBe(158);
    expect(quote.recurringMonthly).toBe(158);
  });

  it('adds 8% SST for a Malaysian buyer and pays the affiliate on the pre-tax amount', () => {
    const item = subscriptionItem('professional', 'month');
    const quote = buildQuote({ item: item!, country: 'MY', coupon });
    expect(quote.discount).toBe(9.9);
    expect(quote.taxRate).toBe(0.08);
    expect(quote.tax).toBe(7.13);
    expect(quote.total).toBe(96.23);
    expect(quote.commission).toBe(8.91);
    expect(quote.taxLabel).toBe('SST');
  });

  it('does not tax a wallet top-up or a school invoice twice', () => {
    expect(taxRateFor('wallet', 'MY', 'MYR')).toBe(0);
    expect(taxRateFor('invoice', 'MY', 'USD')).toBe(0);
    expect(taxRateFor('course', 'SG', 'MYR')).toBe(0.08);
  });

  it('rejects more than six seats', () => {
    const item = subscriptionItem('primary_secondary', 'year');
    expect(() => buildQuote({ item: item!, seats: 8, country: 'US' })).toThrow(QuoteError);
  });

  it('rejects a dead coupon and ignores amount-off in the wrong currency', () => {
    expect(couponRejection({ ...coupon, active: false }, 'USD', '2026-10-15')).toMatch(/not active/);
    expect(couponRejection({ ...coupon, expiresAt: '2026-01-01' }, 'USD', '2026-10-15')).toMatch(/expired/);
    const amountOff: Coupon = { ...coupon, percentOff: undefined, amountOff: 5, currency: 'MYR' };
    expect(couponRejection(amountOff, 'USD', '2026-10-15')).toMatch(/currency/);
    expect(discountMinor(10_000, coupon)).toBe(1000);
    expect(commissionMinor(9000, coupon)).toBe(900);
  });

  it('builds a referral code and a MyInvois document that is not submitted', () => {
    expect(referralCode('Harry Seggu', 'ab12')).toBe('HARRYSEGAB12');
    const doc = buildMyInvois({
      currency: 'MYR', description: 'IGCSE', taxExclusive: 79, tax: 6.32,
      buyer: { name: 'Aina' },
    });
    expect(doc.status).toBe('missing_supplier');
    expect(doc.typeCode).toBe('01');
    expect(doc.taxInclusiveAmount).toBe(85.32);
  });

  it('sells the published Spark packs and wallet amounts', () => {
    expect(SPARK_PACKS.map((pack) => pack.sparks)).toEqual([100, 500, 2000]);
    expect(walletTopUpItem('25', 'USD')?.unitAmount).toBe(25);
    expect(walletTopUpItem('7', 'USD')).toBeNull();
  });
});

describe('fulfillment grants and refunds', () => {
  const paid = {
    checkoutId: 'chk_1', userId: 'parent', buyerName: 'Parent', kind: 'subscription' as const,
    sku: 'igcse_alevel', title: 'IGCSE', currency: 'USD', total: 118.5, subtotal: 118.5,
    discount: 0, tax: 0, taxRate: 0, accessTier: 2, seats: 2, childIds: ['child'],
    commission: 0, provider: 'stripe', interval: 'month' as const, recurringMonthly: 118.5,
  };

  it('grants the plan to the buyer and the sibling', () => {
    const actions = planGrants(paid).filter((grant) => grant.action === 'set_subscription').map((grant) => grant.userId);
    expect(actions).toEqual(['parent', 'child']);
  });

  it('pays the teacher 70% of the pre-tax course price', () => {
    expect(teacherPayoutMajor(100, 7000)).toBe(70);
    const grants = planGrants({
      ...paid, kind: 'course', sku: 'course_1', ownerId: 'teacher', teacherShareBps: 7000, childIds: [], seats: 1,
    });
    expect(grants.find((grant) => grant.action === 'payout')).toMatchObject({ payeeId: 'teacher', amount: 82.95 });
  });

  it('puts a Reads book on the shelf and a Reads plan on the account', () => {
    const book = readsBookItem('harbour-light', 'MYR');
    expect(book).toMatchObject({ unitAmount: 24, currency: 'MYR', shelf: true });
    const quote = buildQuote({ item: book!, country: 'MY' });
    expect(quote.total).toBe(25.92);
    const grants = planGrants({
      ...paid, kind: 'book', sku: 'harbour-light', shelf: true, childIds: [], seats: 1, ownerId: 'platform',
    });
    expect(grants.some((grant) => grant.action === 'grant_library' && grant.bookId === 'harbour-light')).toBe(true);
    expect(grants.some((grant) => grant.action === 'enroll_course')).toBe(false);

    const family = readsPlanItem('reads-family', 'year');
    expect(family).toMatchObject({ unitAmount: 150, currency: 'USD', permission: 'plan:reads-family', recurringMonthly: 12.5 });
    const plan = planGrants({
      ...paid, kind: 'reads', sku: 'reads-family', permission: 'plan:reads-family', accessTier: 1, childIds: [], seats: 1,
    });
    expect(plan.find((grant) => grant.action === 'grant_reads')).toMatchObject({ permission: 'plan:reads-family', accessTier: 1 });
    const reversal = planReversal({
      ...paid, kind: 'reads', sku: 'reads', permission: 'plan:reads', childIds: [], seats: 1,
    });
    expect(reversal.some((grant) => grant.action === 'revoke_reads')).toBe(true);
  });

  it('claws Sparks back on refund', () => {
    const grants = planReversal({ ...paid, kind: 'sparks', sparks: 500, childIds: [], seats: 1 });
    expect(grants.find((grant) => grant.action === 'grant_sparks')?.sparks).toBe(-500);
  });
});

describe('webhooks are idempotent and verified', () => {
  it('skips an event that already finished', () => {
    expect(claimDecision(null, 1_000)).toBe('process');
    expect(claimDecision({ status: 'processed', at: 1 }, 9_000)).toBe('skip');
    expect(claimDecision({ status: 'processing', at: 1_000 }, 5_000)).toBe('skip');
    expect(claimDecision({ status: 'error', at: 1 }, 9_000)).toBe('process');
  });

  it('routes a unified Checkout session and leaves the old course metadata alone', () => {
    expect(parseStripeEvent({
      id: 'evt_1', type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', amount_total: 1900, currency: 'usd', metadata: { checkoutId: 'chk_9' } } },
    })).toMatchObject({ type: 'unified_paid', checkoutId: 'chk_9', amount: 19 });
    expect(parseStripeEvent({
      id: 'evt_2', type: 'checkout.session.completed',
      data: { object: { id: 'cs_2', amount_total: 4900, currency: 'usd', metadata: { kind: 'course', studentId: 's', courseId: 'c' } } },
    }).type).toBe('legacy_course');
    expect(parseStripeEvent({
      id: 'evt_book', type: 'checkout.session.completed',
      data: { object: { metadata: { kind: 'book', studentId: 's', bookId: 'harbour-light' } } },
    })).toMatchObject({ type: 'legacy_book', bookId: 'harbour-light' });
    expect(parseStripeEvent({
      id: 'evt_reads', type: 'checkout.session.completed',
      data: { object: { metadata: { kind: 'plan', uid: 'u', id: 'reads-family' } } },
    })).toMatchObject({ type: 'legacy_reads', planId: 'reads-family' });
  });

  it('accepts a Billplz callback only when the signature matches', () => {
    const params = { id: 'bill_1', paid: 'true', reference_1: 'chk_1', collection_id: 'col' };
    const signed = { ...params, x_signature: billplzSignature('secret', params) };
    expect(verifyGatewayNotice('billplz', 'secret', signed)).toMatchObject({ ok: true, paid: true, checkoutId: 'chk_1' });
    expect(verifyGatewayNotice('billplz', 'secret', { ...signed, x_signature: 'nope' }).ok).toBe(false);
  });

  it('signs iPay88 amounts without the decimal point and checks RMS', () => {
    expect(ipay88Amount(12.5)).toBe('1250');
    const signature = ipay88Signature({ merchantKey: 'key', merchantCode: 'M1', refNo: 'chk_1', amount: '1250', currency: 'MYR', status: '1' });
    expect(signature).toHaveLength(128);
    const rms = rmsSignature({ txnId: 't1', orderId: 'chk_1', status: '00', merchantId: 'shop', amount: '10.00', currency: 'MYR', secret: 'sek' });
    expect(rms).toHaveLength(32);
  });
});

describe('providers fall back to mock mode and secrets stay masked', () => {
  it('treats a missing Stripe key as mock and a live key as live', () => {
    expect(stripeMode(undefined)).toBe('mock');
    expect(stripeMode('sk_test_123')).toBe('test');
    expect(stripeMode('sk_live_123')).toBe('live');
    expect(gatewayMode('billplz', {})).toBe('mock');
    expect(gatewayMode('billplz', { billplzApiKey: 'k', billplzCollectionId: 'c' })).toBe('test');
  });

  it('masks stored secrets and lists the keys Harry must provide', () => {
    expect(isPlaceholder('YOUR_OPENROUTER_API_KEY')).toBe(true);
    expect(maskSecret('sk_test_51abcXYZ')).toBe('sk_t••••cXYZ');
    const view = describeSecret(SECRET_SLOTS[0], undefined, null);
    expect(view.state).toBe('missing');
    expect(missingRequired([view]).map((item) => item.envVar)).toContain('STRIPE_SECRET_KEY');
    const names = harrySetup().flatMap((account) => account.keys.map((key) => key.envVar));
    expect(names).toEqual(expect.arrayContaining([
      'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'BILLPLZ_API_KEY', 'MYINVOIS_CLIENT_ID',
      'FIREBASE_SERVICE_ACCOUNT', 'ZOOM_CLIENT_SECRET', 'WHATSAPP_TOKEN', 'OPENROUTER_API_KEY',
    ]));
  });
});

describe('finance totals', () => {
  it('computes MRR, ARR and ARPU from active subscriptions', () => {
    const summary = summariseFinance([
      { status: 'active', monthlyRecurring: 79 },
      { status: 'active', monthlyRecurring: 19 },
      { status: 'canceled', monthlyRecurring: 99 },
    ]);
    expect(summary).toEqual({ mrr: 98, arr: 1176, arpu: 49, activeSubscribers: 2 });
    expect(reconcile([{ invoiceId: 'a' }, { invoiceId: null }])).toEqual({ matched: 1, unmatched: 1, total: 2 });
  });
});
