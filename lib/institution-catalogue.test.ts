import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATALOGUE_PLACEHOLDER,
  billableSeats,
  catalogueDocumentLines,
  normalizeCatalogue,
  priceCatalogue,
  programmeRevenue,
  planTierReview,
  proratedSeatAdd,
  seedInstitutionCatalogue,
  tierForSeats,
  tierRangeLabel,
  tierUnitMonthly,
  seatOverage,
  institutionLibraryIncludes,
  sameSelection,
  studentSeesPaidCourse,
  validateCatalogue,
} from './institution-catalogue';

describe('institution catalogue pricing', () => {
  it('marks every seed amount as a placeholder', () => {
    const seed = seedInstitutionCatalogue();
    assert.equal(seed.placeholder, true);
    assert.match(seed.note, new RegExp(CATALOGUE_PLACEHOLDER));
    assert.ok(seed.items.every((entry) => entry.placeholder));
    assert.ok(seed.tiers.every((tier) => tier.placeholder));
    assert.ok(seed.currencies.every((currency) => currency.placeholder));
    assert.deepEqual(seed.tiers.map((tier) => tier.name), ['Micro', 'Starter', 'Growth', 'Pro', 'Enterprise']);
    assert.deepEqual(seed.tiers.map((tier) => tierRangeLabel(tier)), ['1–20', '21–50', '51–100', '101–300', '300+']);
    assert.equal(seed.tiers[4]?.quoteContact, true);
    assert.equal(seed.tiers[4]?.selfServe, true);
    assert.ok(seed.tiers.every((tier) => tier.features.length > 0 && tier.seatPrices.length === seed.items.length));
    for (const entry of seed.items) {
      const prices = seed.tiers.map((tier) => tierUnitMonthly(tier, entry));
      for (let index = 1; index < prices.length; index += 1) {
        assert.ok(prices[index]! < prices[index - 1]!, `${entry.id} price falls as the tier grows`);
      }
    }
  });

  it('sums per-seat prices, then applies the tier, the annual discount, currency, and tax', () => {
    const quote = priceCatalogue({
      itemIds: ['igcse', 'maths'],
      purchasedSeats: 80,
      activeSeats: 80,
      interval: 'annual',
      country: 'MY',
      tender: 'card',
    });
    assert.ok(!('error' in quote));
    if ('error' in quote) return;
    assert.equal(quote.tierLabel, 'Growth');
    assert.equal(quote.tierDiscount, 0.1);
    assert.equal(quote.lines[0]?.unit, 86.4);
    assert.equal(quote.lines[1]?.unit, 34.56);
    assert.equal(quote.subtotalUsd, 9676.8);
    assert.equal(quote.currency, 'MYR');
    assert.equal(quote.subtotal, 45480.96);
    assert.equal(quote.tax, 3638.48);
    assert.equal(quote.sparks, 80 * 8 + 80 * 2);
    assert.equal(quote.placeholder, true);
  });

  it('bills active students with a minimum, and keeps a soft seat cap', () => {
    const catalogue = seedInstitutionCatalogue();
    const sen = catalogue.items.find((entry) => entry.id === 'rise-sen')!;
    assert.equal(billableSeats(sen, 10, 2), 5);
    assert.equal(billableSeats(sen, 10, 12), 12);
    assert.deepEqual(seatOverage(sen, 10, 12), { status: 'auto_add', extra: 2 });
    const core = catalogue.items.find((entry) => entry.id === 'igcse')!;
    assert.deepEqual(seatOverage(core, 10, 12), { status: 'prompt', extra: 2 });
    const quote = priceCatalogue({
      itemIds: ['igcse'],
      purchasedSeats: 10,
      activeSeats: 12,
      interval: 'monthly',
      country: 'GB',
      tender: 'card',
    });
    assert.ok(!('error' in quote));
    if ('error' in quote) return;
    assert.equal(quote.lines[0]?.seats, 10);
    assert.match(quote.notices[0] ?? '', /Add seats/);
    assert.equal(proratedSeatAdd({ perSeat: 10, extra: 2, daysRemaining: 10, daysInPeriod: 30 }), 6.67);
  });

  it('shows a student only the paid programme assigned to their level', () => {
    assert.equal(sameSelection(['maths', 'igcse'], ['igcse', 'maths']), true);
    assert.equal(sameSelection(['igcse'], ['igcse', 'maths']), false);
    assert.equal(institutionLibraryIncludes(seedInstitutionCatalogue(), ['igcse'], { level: 'IGCSE' }), true);
    assert.equal(institutionLibraryIncludes(seedInstitutionCatalogue(), ['primary'], { level: 'Law' }), false);
    assert.equal(institutionLibraryIncludes(seedInstitutionCatalogue(), ['igcse'], { subject: 'Art' }), true);
    const grants = [{ itemId: 'igcse', studentIds: [], levels: ['IGCSE'] }];
    assert.equal(studentSeesPaidCourse({
      paidIds: ['igcse'],
      grants,
      studentId: 'ada',
      studentLevel: 'IGCSE',
      course: { programmeId: 'igcse', level: 'IGCSE' },
    }), true);
    assert.equal(studentSeesPaidCourse({
      paidIds: ['igcse'],
      grants,
      studentId: 'ada',
      studentLevel: 'Law',
      course: { programmeId: 'law-school', level: 'Law' },
    }), false);
    assert.equal(studentSeesPaidCourse({
      paidIds: ['maths'],
      grants: [{ itemId: 'maths', studentIds: ['ada'], levels: [] }],
      studentId: 'bee',
      studentLevel: 'IGCSE',
      course: { categoryId: 'maths', level: 'IGCSE' },
    }), false);
    assert.equal(studentSeesPaidCourse({
      paidIds: ['igcse'],
      grants,
      studentId: 'ada',
      studentLevel: 'IGCSE',
      course: { subject: 'Art' },
    }), true);
  });

  it('groups revenue by academy and programme, and prints a quote', () => {
    const cells = programmeRevenue([
      { institutionId: 'north', name: 'North Academy', currency: 'MYR', lines: [{ id: 'igcse', title: 'IGCSE core', amount: 100 }, { id: 'igcse', title: 'IGCSE core', amount: 20 }] },
      { institutionId: 'south', name: 'South Academy', currency: 'GBP', lines: [{ id: 'primary', title: 'Primary', amount: 40 }] },
    ]);
    assert.equal(cells.find((cell) => cell.institutionId === 'north')?.amount, 120);
    assert.equal(cells.find((cell) => cell.itemId === 'primary')?.currency, 'GBP');
    const quote = priceCatalogue({ itemIds: ['primary'], purchasedSeats: 50, interval: 'monthly', country: 'US', tender: 'invoice' });
    assert.ok(!('error' in quote));
    if ('error' in quote) return;
    const pdf = catalogueDocumentLines({ kind: 'quote', institutionName: 'North Academy', issuedOn: '2026-10-17', quote });
    assert.match(pdf[0] ?? '', /quote/);
    assert.match(pdf.join('\n'), /PLACEHOLDER/);
    assert.equal(quote.tax, 0);
  });

  it('prices every selected programme and keeps the tier on unique students', () => {
    const two = priceCatalogue({
      itemIds: ['igcse', 'primary'],
      purchasedSeats: 40,
      interval: 'annual',
      country: 'US',
      tender: 'invoice',
    });
    assert.ok(!('error' in two));
    if ('error' in two) return;
    assert.equal(two.tierLabel, 'Starter');
    assert.equal(two.uniqueStudents, 40);
    assert.equal(two.programmeCount, 2);
    assert.equal(two.bundleDiscount, 0.05);
    assert.equal(two.lines[0]?.unit, 86.64);
    assert.equal(two.lines[1]?.unit, 69.31);
    assert.equal(two.subtotalUsd, 6238);
    const three = priceCatalogue({
      itemIds: ['igcse', 'primary', 'law-school'],
      purchasedSeats: 40,
      interval: 'monthly',
      country: 'US',
      tender: 'invoice',
    });
    assert.ok(!('error' in three));
    if ('error' in three) return;
    assert.equal(three.bundleDiscount, 0.1);
    assert.equal(three.tierLabel, 'Starter');
  });

  it('keeps a saved catalogue and falls back when the document is not a catalogue', () => {
    const seed = seedInstitutionCatalogue();
    const saved = normalizeCatalogue({ ...seed, annualDiscount: 0.25, placeholder: false, items: seed.items.map((entry) => ({ ...entry, placeholder: false })) });
    assert.equal(saved.annualDiscount, 0.25);
    assert.equal(saved.placeholder, false);
    assert.equal(normalizeCatalogue({ currency: 'USD' }).placeholder, true);
    const broken = { ...seed, tiers: [{ ...seed.tiers[0], minSeats: 10, maxSeats: 1 }] };
    assert.equal(validateCatalogue(broken as typeof seed), 'A tier maximum is at least its minimum.');
    assert.equal(normalizeCatalogue(broken).tiers[0]?.id, 'micro');
    const grown = seedInstitutionCatalogue();
    const growth = grown.tiers.find((tier) => tier.id === 'growth')!;
    growth.seatPrices = growth.seatPrices.map((row) => row.itemId === 'igcse' ? { ...row, perSeatMonthly: 7 } : row);
    const custom = priceCatalogue({ catalogue: grown, itemIds: ['igcse'], purchasedSeats: 80, interval: 'monthly', country: 'US', tender: 'card' });
    assert.ok(!('error' in custom));
    if (!('error' in custom)) assert.equal(custom.lines[0]?.unit, 7);
    const enterpriseTier = seed.tiers.find((tier) => tier.id === 'enterprise');
    const enterprise = priceCatalogue({ itemIds: ['igcse'], purchasedSeats: 301, interval: 'monthly', country: 'US', tender: 'card' });
    assert.ok(!('error' in enterprise));
    if (!('error' in enterprise) && enterpriseTier) {
      assert.equal(enterprise.tierLabel, 'Enterprise');
      assert.equal(enterprise.quoteContact, true);
      assert.equal(enterprise.selfServe, true);
      assert.equal(enterprise.lines[0]?.unit, tierUnitMonthly(enterpriseTier, seed.items[0]!));
    }
    assert.equal(tierForSeats(seed, 20)?.name, 'Micro');
    assert.equal(tierForSeats(seed, 21)?.name, 'Starter');
    assert.equal(tierForSeats(seed, 100)?.name, 'Growth');
    assert.equal(tierForSeats(seed, 300)?.name, 'Pro');
    assert.equal(tierRangeLabel({ minSeats: 301, maxSeats: null }), '300+');
  });

  it('moves up a tier when the student count grows, and suggests a cheaper tier at renewal', () => {
    const period = { periodStart: '2026-01-01', periodEnd: '2027-01-01', on: '2026-07-02' };
    const grown = planTierReview({
      currentSeats: 50,
      currentTotal: 4000,
      students: 60,
      itemIds: ['igcse'],
      interval: 'annual',
      country: 'US',
      tender: 'invoice',
      ...period,
    });
    assert.ok(!('error' in grown));
    if ('error' in grown) return;
    assert.equal(grown.action, 'upgrade');
    assert.equal(grown.fromName, 'Starter');
    assert.equal(grown.toName, 'Growth');
    assert.equal(grown.nextSeats, 60);
    assert.equal(grown.charge > 0, true);
    assert.equal(grown.savings, 0);
    assert.match(grown.message, /Growth matches 60 unique students/);
    const same = planTierReview({
      currentSeats: 80,
      currentTotal: 9000,
      students: 90,
      itemIds: ['igcse'],
      interval: 'annual',
      country: 'US',
      tender: 'invoice',
      ...period,
    });
    assert.ok(!('error' in same));
    if (!('error' in same)) assert.equal(same.action, 'stay');
    const smaller = planTierReview({
      currentSeats: 80,
      currentTotal: 9000,
      students: 40,
      itemIds: ['igcse'],
      interval: 'annual',
      country: 'US',
      tender: 'invoice',
      ...period,
    });
    assert.ok(!('error' in smaller));
    if ('error' in smaller) return;
    assert.equal(smaller.action, 'suggest_downgrade');
    assert.equal(smaller.toName, 'Starter');
    assert.equal(smaller.charge, 0);
    assert.equal(smaller.savings > 0, true);
    assert.match(smaller.message, /At renewal on 2027-01-01/);
    const empty = planTierReview({
      currentSeats: 80,
      currentTotal: 9000,
      students: 0,
      itemIds: ['igcse'],
      interval: 'annual',
      country: 'US',
      ...period,
    });
    assert.ok(!('error' in empty));
    if (!('error' in empty)) assert.equal(empty.action, 'stay');
  });
});
