import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessBadge,
  accountFee,
  blankPublication,
  buildExport,
  checkoutChoices,
  commerceEmail,
  defaultTeacherPlan,
  deletionPlan,
  guardSparkSpend,
  holdsAccess,
  householdBill,
  institutionDecides,
  mayChangeLearningRecord,
  payMarketplace,
  pdpaGate,
  postWallet,
  platformPlaces,
  requestMarketplace,
  requiresParentalConsent,
  scaleSeats,
  setAccessMode,
  teacherPayout,
  teacherSubmits,
  usageRoi,
} from './institution-commerce';

test('independent students pay their plan, parents are free, and the second child is 30% off', () => {
  const student = accountFee({ role: 'student', membership: 'independent', planUsd: 79 });
  assert.equal(student.billedTo, 'individual');
  assert.equal(student.amountUsd, 79);
  const parent = accountFee({ role: 'parent', membership: 'independent', planUsd: 79 });
  assert.equal(parent.amountUsd, 0);
  const teacher = accountFee({ role: 'teacher', membership: 'independent', planUsd: 0 });
  assert.equal(teacher.product, 'teacher_plan');
  assert.equal(teacher.amountUsd, defaultTeacherPlan().monthlyUsd);
  const seated = accountFee({ role: 'student', membership: 'institution', planUsd: 79 });
  assert.equal(seated.billedTo, 'institution');
  assert.equal(seated.amountUsd, 0);
  const staff = accountFee({ role: 'teacher', membership: 'institution', planUsd: 29 });
  assert.equal(staff.amountUsd, 0);
  const home = householdBill([
    { membership: 'independent', listUsd: 79 },
    { membership: 'independent', listUsd: 79 },
    { membership: 'institution', listUsd: 79 },
  ]);
  assert.equal(home.lines[0]?.discountPercent, 0);
  assert.equal(home.lines[1]?.amountUsd, 55.3);
  assert.equal(home.lines[2]?.billedTo, 'institution');
  assert.equal(home.parentTotalUsd, 134.3);
});

test('marketplace takes a card, a wallet, or an institution invoice, and refuses Sparks', () => {
  const card = payMarketplace({ tender: 'card', priceUsd: 40 });
  assert.ok(!('error' in card) && card.channel === 'card');
  const wallet = payMarketplace({ tender: 'wallet', priceUsd: 40, walletBalance: 40 });
  assert.ok(!('error' in wallet) && wallet.channel === 'wallet');
  const sparks = payMarketplace({ tender: 'sparks', priceUsd: 40 });
  assert.ok('error' in sparks && /Sparks/.test(sparks.error));
  const short = payMarketplace({ tender: 'wallet', priceUsd: 40, walletBalance: 10 });
  assert.ok('error' in short && /wallet/i.test(short.error));
  const invoice = payMarketplace({ tender: 'institution_invoice', priceUsd: 40 });
  assert.ok(!('error' in invoice) && invoice.channel === 'institution_invoice');
  const split = teacherPayout({ grossUsd: 100, connectAccountId: 'acct_1' });
  assert.ok(!('error' in split));
  if ('error' in split) return;
  assert.equal(split.teacherUsd, 70);
  assert.equal(split.platformUsd, 30);
  const unconnected = teacherPayout({ grossUsd: 100, connectAccountId: '' });
  assert.ok('error' in unconnected && /Stripe/.test(unconnected.error));
});

test('access mode is subscription, a la carte, or both, and a lapse closes only the subscription', () => {
  const blockedMode = setAccessMode({ mode: 'a_la_carte', alaCarteEligible: false, alaCarteUsd: 40, actor: 'admin' });
  assert.ok('error' in blockedMode && /a la carte/.test(blockedMode.error));
  const both = setAccessMode({ mode: 'both', alaCarteEligible: true, alaCarteUsd: 40, actor: 'creator' });
  assert.ok(!('error' in both) && both.pendingApproval);
  assert.deepEqual(checkoutChoices('both'), ['subscription', 'a_la_carte']);
  assert.match(accessBadge('subscription').detail, /ends when it ends/);
  assert.equal(holdsAccess({ choice: 'subscription', subscriptionOpen: false, purchased: false }), false);
  assert.equal(holdsAccess({ choice: 'a_la_carte', subscriptionOpen: false, purchased: true }), true);
});

test('a teacher course needs the institution admin, then Poket School, before the marketplace', () => {
  const submitted = teacherSubmits(blankPublication());
  assert.equal(submitted.library, 'pending');
  assert.equal(submitted.marketplace, 'hidden');
  const tooSoon = requestMarketplace(submitted);
  assert.ok('error' in tooSoon);
  const approved = institutionDecides(submitted, 'approved');
  assert.ok(!('error' in approved));
  if ('error' in approved) return;
  const asked = requestMarketplace(approved);
  assert.ok(!('error' in asked));
  if ('error' in asked) return;
  const blocked = platformPlaces(submitted, { marketplace: 'approved', featured: true, core: false, levels: [], institutionIds: [] });
  assert.ok('error' in blocked);
  const placed = platformPlaces(asked, {
    marketplace: 'approved', featured: true, core: true, levels: ['igcse_alevel'], institutionIds: ['north'],
  });
  assert.ok(!('error' in placed));
  if ('error' in placed) return;
  assert.equal(placed.featured, true);
  assert.deepEqual(placed.levels, ['igcse_alevel']);
  const core = platformPlaces(blankPublication('platform'), {
    marketplace: 'hidden', featured: false, core: true, levels: ['primary_secondary'], institutionIds: [],
  });
  assert.equal(core.library, 'approved');
});

test('seats scale with a pro-rated charge, and usage reports a cost per student', () => {
  const up = scaleSeats({
    seats: 40, activeStudents: 42, periodStart: '2026-01-01', periodEnd: '2026-12-31', on: '2026-07-02', perSeat: 14.52,
  });
  assert.ok(!('error' in up));
  if ('error' in up) return;
  assert.equal(up.seats, 42);
  assert.ok(up.charge > 0);
  assert.equal(up.credit, 0);
  const down = scaleSeats({
    seats: 40, activeStudents: 38, periodStart: '2026-01-01', periodEnd: '2026-12-31', on: '2026-07-02', perSeat: 14.52,
  });
  assert.ok(!('error' in down) && down.credit > 0 && down.charge === 0);
  const roi = usageRoi({
    currency: 'USD', invoiceUsd: 580.99, activeStudents: 40, lessonsCompleted: 800,
    certificatesIssued: 10, attendanceRate: 0.92, sparksSpent: 9000, sparksAllowance: 32000,
  });
  assert.equal(roi.costPerStudent, 14.52);
  assert.equal(roi.attendancePercent, 92);
  assert.match(roi.headline, /14\.52/);
});

test('Sparks stop at the cap and warn when low, and the wallet records purchases, gifts, and refunds', () => {
  const capped = guardSparkSpend({ allowance: 800, spent: 700, amount: 50, cap: 720 });
  assert.ok('error' in capped && /cap/.test(capped.error));
  const low = guardSparkSpend({ allowance: 800, spent: 600, amount: 50, cap: null });
  assert.ok(!('error' in low));
  if ('error' in low) return;
  assert.equal(low.low, true);
  assert.equal(low.remaining, 150);
  const topped = postWallet(25, { kind: 'topup', amount: 10 });
  assert.ok(!('error' in topped) && topped.balance === 35);
  const bought = postWallet(35, { kind: 'purchase', amount: 20 });
  assert.ok(!('error' in bought) && bought.balance === 15);
  const gifted = postWallet(15, { kind: 'gift_out', amount: 5 });
  assert.ok(!('error' in gifted) && gifted.balance === 10);
  const received = postWallet(0, { kind: 'gift_in', amount: 5 });
  assert.ok(!('error' in received) && received.balance === 5);
  const refunded = postWallet(10, { kind: 'refund', amount: 20 });
  assert.ok(!('error' in refunded) && refunded.balance === 30);
  const overdrawn = postWallet(3, { kind: 'purchase', amount: 4 });
  assert.ok('error' in overdrawn && /zero/.test(overdrawn.error));
});

test('PDPA consent, parental consent, export, and deletion are explicit', () => {
  assert.equal(requiresParentalConsent(17), true);
  assert.equal(requiresParentalConsent(18), false);
  const missingPrivacy = pdpaGate({ terms: true, privacy: false, minor: false, parentalVerified: false });
  assert.ok('error' in missingPrivacy && /PDPA/.test(missingPrivacy.error));
  const missingGuardian = pdpaGate({ terms: true, privacy: true, minor: true, parentalVerified: false });
  assert.ok('error' in missingGuardian && /guardian/.test(missingGuardian.error));
  const allowed = pdpaGate({ terms: true, privacy: true, minor: true, parentalVerified: true });
  assert.ok(!('error' in allowed) && allowed.ok);
  const exported = buildExport({
    exportedAt: '2026-10-16', profile: { name: 'Amina' }, consents: [{ kind: 'pdpa', at: '2026-10-16' }],
    wallet: { balance: 10, currency: 'USD' }, children: ['child'],
  });
  assert.equal(exported.profile.name, 'Amina');
  const plan = deletionPlan('u1');
  assert.ok(plan.erase.some((path) => path.includes('u1')));
  assert.match(plan.retain[0]?.reason ?? '', /7 years/);
  assert.equal(mayChangeLearningRecord('parent'), false);
  assert.equal(mayChangeLearningRecord('teacher'), true);
  assert.match(commerceEmail('low_sparks', 'North Academy').subject, /Sparks/);
});
