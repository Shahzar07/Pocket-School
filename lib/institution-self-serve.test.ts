import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStripeEvent } from './payments/stripe-events';
import {
  approvalDecision,
  checkoutChannel,
  defaultApprovalSettings,
  isFreeEmailDomain,
  parseInstitutionOrder,
  priceInstitutionOrder,
  programmesForLevel,
  quoteSelfServeChange,
  readApprovalSettings,
  sandboxBannerFor,
  scheduledCancellation,
  trialTerms,
  SANDBOX_BANNER,
} from './institution-self-serve';

const review = { ...defaultApprovalSettings(), mode: 'auto_review' as const };

test('approval mode activates, holds, or applies the review rules', () => {
  const card = {
    tender: 'card' as const,
    seats: 40,
    email: 'ada@rochfords.example',
    wantsCustomDomain: false,
    wantsCobrand: false,
    wantsMarketplace: false,
  };
  assert.equal(approvalDecision(defaultApprovalSettings(), card).activate, true);
  assert.equal(approvalDecision(defaultApprovalSettings(), { ...card, tender: 'invoice' }).activate, true);
  assert.equal(approvalDecision({ ...defaultApprovalSettings(), mode: 'manual' }, card).activate, false);
  assert.deepEqual(
    approvalDecision(review, { ...card, tender: 'invoice' }).reasons,
    ['Invoice or purchase order.'],
  );
  assert.equal(approvalDecision(review, { ...card, wantsCustomDomain: true }).activate, false);
  assert.equal(approvalDecision(review, { ...card, wantsCobrand: true }).activate, false);
  assert.equal(approvalDecision(review, { ...card, wantsMarketplace: true }).activate, false);
  assert.equal(approvalDecision(review, { ...card, email: 'ada@gmail.com', seats: 11 }).activate, false);
  assert.equal(approvalDecision(review, { ...card, email: 'ada@gmail.com', seats: 10 }).activate, true);
  assert.equal(approvalDecision(review, { ...card, tender: 'trial', email: 'ada@gmail.com', seats: 80 }).activate, true);
  assert.equal(isFreeEmailDomain('Ada@GoogleMail.com'), true);
  assert.equal(isFreeEmailDomain('ada@rochfords.example'), false);
});

test('stored approval settings fall back to auto', () => {
  assert.equal(readApprovalSettings(undefined).mode, 'auto');
  assert.equal(readApprovalSettings(undefined).trialDays, 14);
  assert.equal(readApprovalSettings({ mode: 'auto_review', trialDays: 21, holdInvoice: false }).holdInvoice, false);
  assert.equal(readApprovalSettings({ trialDays: 0 }).trialDays, 14);
});

test('the live price adds Malaysian tax on card and skips it on an invoice', () => {
  const card = priceInstitutionOrder({
    planId: 'igcse_alevel',
    interval: 'annual',
    seats: 10,
    access: 'subscription',
    programmeIds: ['igcse'],
    country: 'MY',
    tender: 'card',
  });
  assert.ok(!('error' in card));
  if (!('error' in card)) {
    assert.equal(card.placeholder, true);
    assert.equal(card.currency, 'MYR');
    assert.equal(card.subtotal, 4512);
    assert.equal(card.tax, 360.96);
    assert.equal(card.total, 4872.96);
    assert.equal(card.sparks, 80);
    assert.equal(card.tierLabel, '1–50');
    assert.deepEqual(card.programmeTitles, ['IGCSE core']);
  }
  const invoice = priceInstitutionOrder({
    planId: 'igcse_alevel',
    interval: 'annual',
    seats: 50,
    access: 'subscription',
    programmeIds: ['igcse'],
    country: 'MY',
    tender: 'invoice',
  });
  assert.ok(!('error' in invoice));
  if (!('error' in invoice)) assert.equal(invoice.tax, 0);
  const abroad = priceInstitutionOrder({
    planId: 'igcse_alevel',
    interval: 'annual',
    seats: 10,
    access: 'subscription',
    programmeIds: ['igcse'],
    country: 'GB',
    tender: 'card',
  });
  assert.ok(!('error' in abroad));
  if (!('error' in abroad)) {
    assert.equal(abroad.tax, 0);
    assert.equal(abroad.currency, 'GBP');
  }
});

test('a la carte sums the selected programmes and categories by the seat count', () => {
  const alaCarte = programmesForLevel('primary_secondary', 'a_la_carte').map((item) => item.id);
  assert.ok(alaCarte.includes('primary'));
  assert.ok(alaCarte.includes('maths'));
  assert.equal(alaCarte.includes('lower-secondary'), false);
  assert.ok(programmesForLevel('primary_secondary', 'subscription').some((item) => item.id === 'lower-secondary'));
  const priced = priceInstitutionOrder({
    planId: 'primary_secondary',
    interval: 'annual',
    seats: 20,
    access: 'a_la_carte',
    programmeIds: ['primary'],
    country: 'MY',
    tender: 'card',
  });
  assert.ok(!('error' in priced));
  if (!('error' in priced)) {
    assert.equal(priced.subtotal, 7219.2);
    assert.equal(priced.tax, 577.54);
    assert.equal(priced.seats, 20);
    assert.equal(priced.sparks, 120);
    assert.equal(priced.lines[0]?.seats, 20);
  }
  const mixed = priceInstitutionOrder({
    planId: 'primary_secondary',
    interval: 'annual',
    seats: 20,
    access: 'a_la_carte',
    programmeIds: ['lower-secondary'],
    country: 'GB',
    tender: 'card',
  });
  assert.ok('error' in mixed);
});

test('missing payment keys use the sandbox, and a free total does not', () => {
  assert.equal(checkoutChannel({ stripe: false, gateway: false, currency: 'USD', tender: 'card', total: 10 }), 'sandbox');
  assert.equal(checkoutChannel({ stripe: true, gateway: false, currency: 'USD', tender: 'card', total: 10 }), 'stripe');
  assert.equal(checkoutChannel({ stripe: true, gateway: false, currency: 'USD', tender: 'fpx', total: 10 }), 'unsupported');
  assert.equal(checkoutChannel({ stripe: false, gateway: true, currency: 'MYR', tender: 'fpx', total: 10 }), 'gateway');
  assert.equal(checkoutChannel({ stripe: false, gateway: false, currency: 'USD', tender: 'invoice', total: 10 }), 'invoice');
  assert.equal(checkoutChannel({ stripe: false, gateway: false, currency: 'USD', tender: 'card', total: 0 }), 'free');
  assert.equal(sandboxBannerFor('sandbox'), SANDBOX_BANNER);
  assert.equal(sandboxBannerFor('stripe'), '');
});

test('a trial caps seats and needs no card', () => {
  const trial = trialTerms(defaultApprovalSettings(), 80, '2026-10-17');
  assert.ok(!('error' in trial));
  if (!('error' in trial)) {
    assert.equal(trial.seats, 25);
    assert.equal(trial.days, 14);
    assert.equal(trial.periodEnd, '2026-10-31');
  }
});

test('plan changes prorate, and cancellation waits until the period ends', () => {
  const seats = quoteSelfServeChange({
    currentSeats: 10,
    currentTotal: 100,
    currentInterval: 'annual',
    currentPeriodEnd: '2027-01-01',
    nextSeats: 12,
    nextTotal: 120,
    planChanged: false,
    on: '2026-07-02',
  });
  assert.ok(!('error' in seats));
  if (!('error' in seats)) assert.ok(seats.charge > 0);
  const downgrade = quoteSelfServeChange({
    currentSeats: 10,
    currentTotal: 365.99,
    currentInterval: 'annual',
    currentPeriodEnd: '2027-01-01',
    nextSeats: 10,
    nextTotal: 100,
    planChanged: true,
    on: '2026-07-02',
  });
  assert.ok(!('error' in downgrade));
  if (!('error' in downgrade)) assert.ok(downgrade.credit > 0);
  assert.equal(scheduledCancellation({ phase: 'active', cancelOn: '2027-01-01', today: '2027-01-01' }), true);
  assert.equal(scheduledCancellation({ phase: 'active', cancelOn: '2027-01-01', today: '2026-12-01' }), false);
  assert.equal(scheduledCancellation({ phase: 'grace', cancelOn: '2026-01-01', today: '2026-06-01' }), false);
});

test('self-serve card orders are marked for the webhook, and super-admin links are not', () => {
  const parsed = parseInstitutionOrder({
    planId: 'igcse_alevel',
    access: 'subscription',
    tender: 'invoice',
    seats: 60,
    poNumber: 'PO-14',
    wantsCustomDomain: true,
  });
  assert.equal(parsed.ok, true);
  const event = parseStripeEvent({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { metadata: { kind: 'institution_billing', institutionId: 'north', interval: 'annual', selfServe: '1' } } },
  });
  assert.equal(event.type, 'institution_paid');
  if (event.type === 'institution_paid') assert.equal(event.selfServe, true);
  const adminLink = parseStripeEvent({
    id: 'evt_2',
    type: 'checkout.session.completed',
    data: { object: { metadata: { kind: 'institution_billing', institutionId: 'north', interval: 'monthly' } } },
  });
  if (adminLink.type === 'institution_paid') assert.equal(adminLink.selfServe, false);
});
