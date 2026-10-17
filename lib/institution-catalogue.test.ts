import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATALOGUE_PLACEHOLDER,
  billableSeats,
  catalogueDocumentLines,
  normalizeCatalogue,
  priceCatalogue,
  programmeRevenue,
  proratedSeatAdd,
  seedInstitutionCatalogue,
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
    assert.deepEqual(seed.tiers.map((tier) => tier.name), ['Starter', 'Growth', 'Pro', 'Enterprise']);
    assert.deepEqual(seed.tiers.map((tier) => tierRangeLabel(tier)), ['0–50', '51–200', '201–500', '500+']);
    assert.equal(seed.tiers[3]?.quoteContact, true);
    assert.equal(seed.tiers[3]?.selfServe, true);
    assert.ok(seed.tiers.every((tier) => tier.features.length > 0 && tier.seatPrices.length === seed.items.length));
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
    assert.equal(two.lines[0]?.unit, 91.2);
    assert.equal(two.lines[1]?.unit, 72.96);
    assert.equal(two.subtotalUsd, 6566.4);
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
    assert.equal(normalizeCatalogue(broken).tiers[0]?.id, 'starter');
    const grown = seedInstitutionCatalogue();
    const growth = grown.tiers.find((tier) => tier.id === 'growth')!;
    growth.seatPrices = growth.seatPrices.map((row) => row.itemId === 'igcse' ? { ...row, perSeatMonthly: 7 } : row);
    const custom = priceCatalogue({ catalogue: grown, itemIds: ['igcse'], purchasedSeats: 80, interval: 'monthly', country: 'US', tender: 'card' });
    assert.ok(!('error' in custom));
    if (!('error' in custom)) assert.equal(custom.lines[0]?.unit, 7);
    const enterprise = priceCatalogue({ itemIds: ['igcse'], purchasedSeats: 501, interval: 'monthly', country: 'US', tender: 'card' });
    assert.ok(!('error' in enterprise));
    if (!('error' in enterprise)) {
      assert.equal(enterprise.tierLabel, 'Enterprise');
      assert.equal(enterprise.quoteContact, true);
      assert.equal(enterprise.selfServe, true);
      assert.equal(enterprise.lines[0]?.unit, tierUnitMonthly(seed.tiers[3]!, seed.items[0]!));
    }
  });
});
