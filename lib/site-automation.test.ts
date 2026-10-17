import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTOMATION_RULES,
  answerSupport,
  brandRuleCheck,
  courseAutomation,
  defaultAutomation,
  planCancelOn,
  productFromCheckout,
  readAutomation,
  refundDecision,
  settleRefund,
} from './site-automation';

test('marketplace listing stays off and the institution library stays on', () => {
  const settings = defaultAutomation();
  assert.equal(settings.rules.marketplace_listing, false);
  assert.equal(settings.rules.teacher_library, true);
  assert.equal(settings.rules.student_refund, true);
  assert.equal(settings.rules.help_et, true);
  assert.equal(settings.rules.institution_join, true);
  assert.equal(settings.rules.alumni_rollover, true);
  const stored = readAutomation({ rules: { marketplace_listing: true, trialDays: 3, student_refund: 'yes' } });
  assert.equal(stored.rules.marketplace_listing, true);
  assert.equal(stored.rules.student_refund, true);
  assert.equal(AUTOMATION_RULES.length >= 20, true);
});

test('refunds follow the policy window', () => {
  const annual = refundDecision({ enabled: true, product: 'subscription_year', billedOn: '2026-10-10', today: '2026-10-17', amount: 365 });
  assert.equal(annual.outcome, 'refund');
  assert.equal(annual.amount, 358);
  const late = refundDecision({ enabled: true, product: 'subscription_year', billedOn: '2026-09-01', today: '2026-10-17', amount: 365 });
  assert.equal(late.outcome, 'review');
  assert.equal(refundDecision({ enabled: true, product: 'subscription_month', billedOn: '2026-10-17', today: '2026-10-17', amount: 20 }).outcome, 'refuse');
  assert.equal(refundDecision({ enabled: true, product: 'sparks', billedOn: '2026-10-17', today: '2026-10-17', amount: 5 }).outcome, 'refuse');
  assert.equal(refundDecision({ enabled: true, product: 'course', billedOn: '2026-10-17', today: '2026-10-17', amount: 40 }).outcome, 'refund');
  assert.equal(refundDecision({ enabled: false, product: 'course', billedOn: '2026-10-17', today: '2026-10-17', amount: 40 }).outcome, 'review');
  assert.equal(productFromCheckout('subscription', 'year'), 'subscription_year');
  const parked = settleRefund({ outcome: 'refund', hasProvider: false, reason: 'Course purchase refunded inside 14 days.' });
  assert.equal(parked.outcome, 'review');
});

test('a clean course enters the library and the marketplace stays gated', () => {
  const description = 'Forces, motion, and the experiments students run in class this term.';
  const clean = brandRuleCheck({ title: 'Forces', description, level: 'IGCSE' });
  assert.equal(clean.ok, true);
  const year = brandRuleCheck({ title: 'Year 10 physics', description });
  assert.equal(year.ok, false);
  const library = courseAutomation({ libraryAuto: true, marketplaceAuto: false, wantsMarketplace: true, brandOk: true, issues: [] });
  assert.equal(library.library, 'approved');
  assert.equal(library.marketplace, 'pending');
  assert.equal(library.isPublic, false);
  const held = courseAutomation({ libraryAuto: true, marketplaceAuto: true, wantsMarketplace: true, brandOk: false, issues: year.issues });
  assert.equal(held.held, true);
  assert.equal(held.marketplace, 'hidden');
  const manual = courseAutomation({ libraryAuto: false, marketplaceAuto: false, wantsMarketplace: false, brandOk: true, issues: [] });
  assert.equal(manual.library, 'pending');
});

test('ET answers a known question and escalates the rest', () => {
  const settings = defaultAutomation();
  const reset = answerSupport('I forgot my password', settings);
  assert.equal(reset.matched, true);
  assert.equal(reset.escalate, false);
  const odd = answerSupport('Can the school hamster sit the exam?', settings);
  assert.equal(odd.escalate, true);
  const closed = answerSupport('I forgot my password', readAutomation({ rules: { help_faq: false, help_et: false } }));
  assert.equal(closed.escalate, true);
  assert.equal(closed.matched, false);
});

test('a student cancellation lands on the period end', () => {
  assert.equal(planCancelOn('2026-10-17', 'month'), '2026-11-17');
  assert.equal(planCancelOn('2026-10-17', 'year'), '2027-10-17');
});
