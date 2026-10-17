import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { claimDecision } from '../payments/idempotency';
import {
  FAMILY_BUNDLE_DISCOUNT,
  chainHash,
  childAccessCopy,
  guardianCanPay,
  manageDestination,
  mapRevenueCatEvent,
  parentPayDecision,
  productTier,
  purchaseGate,
  quoteFamily,
  reminderDue,
  secretMatches,
  splitFamilyTransfer,
  courseUnlockUids,
  unlockUids,
  withinSpendingCap,
  canTakeOverBilling,
} from './model';

describe('RevenueCat events land on the shared entitlement', () => {
  const base = {
    id: 'evt_1',
    app_user_id: 'parent_1',
    product_id: 'poket_igcse_alevel_monthly',
    expiration_at_ms: 1_900_000_000_000,
    store: 'APP_STORE',
    original_transaction_id: 'txn_9',
    subscriber_attributes: { beneficiaries: { value: 'child_a,child_b' } },
  };

  it('maps a purchase onto the children and keeps the price out of the product table', () => {
    expectProductHasNoPrice();
    const mapped = mapRevenueCatEvent({ ...base, type: 'INITIAL_PURCHASE' });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.decision.status, 'active');
    assert.equal(mapped.decision.source, 'apple');
    assert.equal(mapped.decision.accessTier, 2);
    assert.deepEqual(mapped.decision.beneficiaryUids, ['child_a', 'child_b']);
    assert.deepEqual(mapped.decision.audit, ['purchase']);
    assert.deepEqual(unlockUids('parent_1', mapped.decision.beneficiaryUids), ['child_a', 'child_b']);
    assert.deepEqual(courseUnlockUids('parent_1', ['parent_1', 'child_a']), ['child_a']);
    assert.deepEqual(courseUnlockUids('adult_1', ['adult_1']), ['adult_1']);
  });

  it('covers renewal, cancel, expiry, billing issues, product changes, refunds and transfers', () => {
    const renewal = mapRevenueCatEvent({ ...base, type: 'RENEWAL', store: 'PLAY_STORE' });
    assert.equal(renewal.ok && renewal.decision.audit[0], 'renewal');
    assert.equal(renewal.ok && renewal.decision.source, 'google');
    const cancel = mapRevenueCatEvent({ ...base, type: 'CANCELLATION' });
    assert.equal(cancel.ok && cancel.decision.cancelAtPeriodEnd, true);
    assert.equal(cancel.ok && cancel.decision.dropAccess, false);
    const expired = mapRevenueCatEvent({ ...base, type: 'EXPIRATION' });
    assert.equal(expired.ok && expired.decision.status, 'expired');
    assert.equal(expired.ok && expired.decision.dropAccess, true);
    const failed = mapRevenueCatEvent({ ...base, type: 'BILLING_ISSUE' });
    assert.equal(failed.ok && failed.decision.notify, 'failed');
    assert.deepEqual(failed.ok && failed.decision.audit, ['renewal_failed', 'grace_period']);
    const changed = mapRevenueCatEvent({ ...base, type: 'PRODUCT_CHANGE', product_id: 'poket_professional_annual' });
    assert.equal(changed.ok && changed.decision.accessTier, 3);
    const refunded = mapRevenueCatEvent({ ...base, type: 'REFUND' });
    assert.equal(refunded.ok && refunded.decision.audit[0], 'refunded');
    const transfer = mapRevenueCatEvent({ ...base, type: 'TRANSFER', transferred_to: ['guardian_2'] });
    assert.equal(transfer.ok && transfer.decision.payerUid, 'guardian_2');
  });

  it('refuses an unknown product instead of inventing a price', () => {
    const mapped = mapRevenueCatEvent({ ...base, type: 'INITIAL_PURCHASE', product_id: 'poket_secret_49' });
    assert.equal(mapped.ok, false);
  });

  it('is idempotent on the event id', () => {
    assert.equal(claimDecision({ status: 'processed', at: 1 }, 9_000), 'skip');
    assert.equal(claimDecision(null, 1), 'process');
  });
});

describe('family plans, guardians and age', () => {
  it('marks the bundle discount as a placeholder and discounts the 2nd and 3rd child', () => {
    assert.equal(FAMILY_BUNDLE_DISCOUNT.placeholder, true);
    const quote = quoteFamily([
      { uid: 'a', tierId: 'primary_secondary', accessTier: 1, listUsd: 30 },
      { uid: 'b', tierId: 'igcse_alevel', accessTier: 2, listUsd: 80 },
      { uid: 'c', tierId: 'igcse_alevel', accessTier: 2, listUsd: 80 },
    ]);
    assert.equal(quote.lines[0].chargeUsd, 30);
    assert.equal(quote.lines[1].chargeUsd, 72);
    assert.equal(quote.lines[2].chargeUsd, 68);
    assert.equal(quote.subtotalUsd, 170);
    assert.equal(quote.placeholder, true);
  });

  it('lets only an approved guardian pay', () => {
    assert.equal(guardianCanPay({ status: 'approved' }), true);
    assert.equal(guardianCanPay({ status: 'approved', guardianTier: 2 }), true);
    assert.equal(guardianCanPay({ status: 'approved', guardianTier: 1 }), false);
    assert.equal(guardianCanPay({ status: 'pending' }), false);
    assert.equal(guardianCanPay(null), false);
  });

  it('blocks under-18s and lets a parent or an adult pay', () => {
    const now = new Date('2026-10-17T00:00:00Z');
    assert.equal(purchaseGate({ ageTier: 'teen', role: 'student', now }).ok, false);
    assert.equal(purchaseGate({ ageTier: 'under13', role: 'student', now }).ok, false);
    assert.equal(purchaseGate({ role: 'student', now }).ok, false);
    assert.equal(purchaseGate({ ageTier: 'adult', role: 'student', now }).ok, true);
    assert.equal(purchaseGate({ role: 'parent', now }).ok, true);
    assert.equal(canTakeOverBilling({ dateOfBirth: '2008-10-17', now }), true);
    assert.equal(canTakeOverBilling({ dateOfBirth: '2010-01-01', now }), false);
  });

  it('blocks a duplicate school seat and allows a graduation switch', () => {
    assert.equal(parentPayDecision({ seatActive: true, seatTier: 2, requestedTier: 2 }).action, 'block');
    assert.equal(parentPayDecision({ seatActive: true, seatTier: 1, requestedTier: 2 }).action, 'warn');
    assert.equal(parentPayDecision({ seatActive: false, seatTier: 0, requestedTier: 1 }).action, 'allow');
    assert.equal(parentPayDecision({ seatActive: true, seatTier: 2, requestedTier: 2, graduating: true }).action, 'allow');
  });

  it('enforces a spending cap and a clean sponsorship split', () => {
    assert.equal(withinSpendingCap(72, 70), false);
    assert.equal(withinSpendingCap(70, 70), true);
    assert.equal(withinSpendingCap(10, null), true);
    const split = splitFamilyTransfer({ payerUid: 'p', beneficiaryUids: ['a', 'b'], childUid: 'b', nextPayerUid: 'g' });
    assert.deepEqual(split, { previous: ['a'], moved: ['b'] });
  });
});

describe('renewals, store links and the audit chain', () => {
  it('reminds three days before the period end, once', () => {
    const end = 1_000_000;
    const lead = end - 3 * 24 * 60 * 60 * 1000;
    assert.equal(reminderDue({ currentPeriodEnd: end, now: lead - 1, reminderSentFor: null, status: 'active' }), false);
    assert.equal(reminderDue({ currentPeriodEnd: end, now: lead, reminderSentFor: null, status: 'active' }), true);
    assert.equal(reminderDue({ currentPeriodEnd: end, now: lead, reminderSentFor: end, status: 'active' }), false);
    assert.equal(reminderDue({ currentPeriodEnd: end, now: end, reminderSentFor: null, status: 'active' }), false);
  });

  it('sends Apple and Google subscribers to the store', () => {
    assert.equal(manageDestination('apple', 'https://billing.example').kind, 'store');
    assert.match(manageDestination('google', null).url, /play\.google\.com/);
    assert.equal(manageDestination('stripe', 'https://billing.stripe.com/p/session').url, 'https://billing.stripe.com/p/session');
  });

  it('keeps payment details out of the child notice', () => {
    const copy = childAccessCopy();
    assert.doesNotMatch(copy.message, /card|invoice|\$|MYR|last4/i);
    assert.match(copy.message, /do not need to enter any payment details/i);
  });

  it('chains hashes and rejects a bad webhook secret', () => {
    const first = chainHash('', { type: 'purchase', payerUid: 'p', beneficiaryUids: ['c'], at: 1 });
    const second = chainHash(first, { type: 'renewal', payerUid: 'p', beneficiaryUids: ['c'], at: 2 });
    assert.notEqual(first, second);
    assert.equal(chainHash('', { beneficiaryUids: ['c'], payerUid: 'p', at: 1, type: 'purchase' }), first);
    assert.equal(secretMatches('Bearer shh', 'shh'), true);
    assert.equal(secretMatches('nope', 'shh'), false);
    assert.equal(secretMatches(null, 'shh'), false);
  });
});

function expectProductHasNoPrice() {
  const row = productTier('poket_primary_secondary_monthly');
  assert.ok(row);
  assert.equal('monthlyUsd' in (row as object), false);
  assert.equal(row?.tierId, 'primary_secondary');
}
