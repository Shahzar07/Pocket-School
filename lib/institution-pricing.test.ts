import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALEVEL_MATHS_ACTIVELEARN_USD,
  blankPriceOverride,
  documentPdf,
  normalizeVolumeSchedule,
  quoteInstitution,
  quoteLines,
  renewalReminder,
  seatNotices,
  seedInstitutionPricing,
  tierForSeats,
  validateVolumeSchedule,
} from './institution-pricing';

test('seed prices are the published A level maths USD column and nothing else', () => {
  const schedule = seedInstitutionPricing();
  assert.equal(schedule.currency, 'USD');
  const igcse = schedule.plans.find((plan) => plan.id === 'igcse_alevel');
  assert.ok(igcse);
  const fee = (id: string) => igcse.tiers.find((row) => row.tierId === id);
  assert.equal(fee('0-10')?.flatAnnual, ALEVEL_MATHS_ACTIVELEARN_USD.users1to10);
  assert.equal(fee('11-50')?.flatAnnual, ALEVEL_MATHS_ACTIVELEARN_USD.under100);
  assert.equal(fee('51-99')?.flatAnnual, ALEVEL_MATHS_ACTIVELEARN_USD.under100);
  assert.equal(fee('100-300')?.flatAnnual, ALEVEL_MATHS_ACTIVELEARN_USD.users100plus);
  assert.equal(fee('301-plus')?.flatAnnual, ALEVEL_MATHS_ACTIVELEARN_USD.users100plus);
  for (const row of igcse.tiers) {
    assert.equal(row.monthlyPerStudent, 0);
    assert.equal(row.annualPerStudent, 0);
    assert.equal(row.flatMonthly, 0);
  }
  for (const planId of ['primary_secondary', 'professional'] as const) {
    const plan = schedule.plans.find((item) => item.id === planId);
    assert.ok(plan);
    for (const row of plan.tiers) {
      assert.equal(row.flatAnnual, 0);
      assert.equal(row.annualPerStudent, 0);
    }
  }
  for (const addon of schedule.addons) {
    assert.equal(addon.flatAnnual, 0);
    assert.equal(addon.annualPerStudent, 0);
  }
});

test('seat count selects the tier and a live quote uses the flat annual fee', () => {
  const schedule = seedInstitutionPricing();
  assert.equal(tierForSeats(schedule, 10)?.id, '0-10');
  assert.equal(tierForSeats(schedule, 50)?.id, '11-50');
  assert.equal(tierForSeats(schedule, 99)?.id, '51-99');
  assert.equal(tierForSeats(schedule, 100)?.id, '100-300');
  assert.equal(tierForSeats(schedule, 400)?.id, '301-plus');
  const quote = quoteInstitution({ schedule, seats: 40, override: { planId: 'igcse_alevel', interval: 'annual' } });
  assert.equal(quote.platformFee, 580.99);
  assert.equal(quote.perStudent, 0);
  assert.equal(quote.total, 580.99);
  const hundred = quoteInstitution({ schedule, seats: 100, override: { planId: 'igcse_alevel', interval: 'annual' } });
  assert.equal(hundred.platformFee, 917.99);
});

test('a per-institution discount and a custom per-student price change only that quote', () => {
  const schedule = seedInstitutionPricing();
  const quote = quoteInstitution({
    schedule,
    seats: 10,
    override: {
      planId: 'igcse_alevel',
      interval: 'annual',
      discountPercent: 10,
      customPerStudent: 2,
      waivePlatformFee: true,
      addons: ['et_ai_live'],
    },
  });
  assert.equal(quote.platformFee, 0);
  assert.equal(quote.studentTotal, 20);
  assert.equal(quote.discountAmount, 2);
  assert.equal(quote.total, 18);
  assert.equal(quoteInstitution({ schedule, seats: 10 }).total, 365.99);
});

test('over-limit usage on a higher tier prompts an upgrade, and renewal is dated', () => {
  const schedule = seedInstitutionPricing();
  const same = seatNotices({ schedule, seatsPurchased: 20, seatsUsed: 30, renewalOn: '2026-12-01', today: '2026-11-01' });
  assert.equal(same.overLimit, true);
  assert.equal(same.upgradeTo, null);
  assert.equal(same.renewal, 'soon');
  const next = seatNotices({ schedule, seatsPurchased: 10, seatsUsed: 12, renewalOn: '2026-10-16', today: '2026-10-16' });
  assert.equal(next.overLimit, true);
  assert.equal(next.upgradeFrom, '0–10');
  assert.equal(next.upgradeTo, '11–50');
  assert.equal(next.renewal, 'due');
  assert.equal(renewalReminder('2026-10-01', '2026-10-16'), 'lapsed');
});

test('the quote PDF contains the calculated total and no extra price', () => {
  const quote = quoteInstitution({
    schedule: seedInstitutionPricing(),
    seats: 8,
    override: blankPriceOverride({ planId: 'igcse_alevel', interval: 'annual' }),
  });
  const lines = quoteLines({ kind: 'quote', institutionName: 'North Academy', issuedOn: '2026-10-16', quote });
  const pdf = new TextDecoder().decode(documentPdf(lines));
  assert.equal(pdf.startsWith('%PDF-1.4'), true);
  assert.match(pdf, /USD 365\.99/);
  assert.equal(pdf.includes('999.99'), false);
  const broken = { ...seedInstitutionPricing(), tiers: [] };
  assert.equal(validateVolumeSchedule(broken), 'Add at least one student tier.');
  assert.equal(normalizeVolumeSchedule({ currency: 'gbp', tiers: 'nope' }).currency, 'GBP');
});
