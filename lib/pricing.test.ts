import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TIERS } from './entitlements';
import {
  annualFromMonthly,
  currencyForCountry,
  diffPricing,
  formatMoney,
  normalizePricing,
  optionalLocalAmount,
  quoteCourse,
  quotePlan,
  normalizePricing,
  resolveDisplayCurrency,
  roundMoney,
  seedPricing,
  snapToStorePricePoint,
  stripeUnitAmount,
  type PricingConfig,
} from './pricing';

function withMyr(patch: Partial<PricingConfig['currencies'][number]>): PricingConfig {
  const config = seedPricing();
  config.currencies = config.currencies.map(currency =>
    currency.code === 'MYR' ? { ...currency, ...patch } : currency,
  );
  return config;
}

test('USD quotes use the stored monthly and annual amounts', () => {
  const config = seedPricing();
  const monthly = quotePlan(config, 'igcse_alevel', 'monthly', 'USD');
  const annual = quotePlan(config, 'igcse_alevel', 'annual', 'USD');
  assert.equal(monthly?.currency, 'USD');
  assert.equal(monthly?.amount, 79);
  assert.equal(annual?.amount, 708);
  assert.equal(quotePlan(config, 'professional', 'monthly', 'USD'), null);
  assert.equal(quotePlan(config, 'professional', 'annual', 'USD'), null);
  assert.equal(quotePlan(config, 'primary_secondary', 'monthly', 'USD'), null);
  assert.equal(quotePlan(config, 'primary_secondary', 'annual', 'usd'), null);
  assert.equal(annualFromMonthly(79, 0.25), 711);
  assert.equal(config.familyBundleDiscount, null);
  assert.equal(config.reads.find(plan => plan.id === 'reads')?.monthlyUsd, 9);
  assert.equal(config.reads.find(plan => plan.id === 'reads-family')?.monthlyUsd, 15);
});

test('a stored annual price is charged even when the discount would differ', () => {
  const config = seedPricing();
  const plan = config.plans.find(item => item.id === 'primary_secondary');
  assert.ok(plan);
  plan.annualUsd = 100;
  assert.equal(quotePlan(config, 'primary_secondary', 'annual', 'USD')?.amount, 100);
});

test('MYR rate mode applies charm rounding', () => {
  const quote = quotePlan(seedPricing(), 'igcse_alevel', 'monthly', 'MYR');
  assert.equal(quote?.currency, 'MYR');
  assert.equal(quote?.amount, roundMoney(79 * 4.7, 'charm', 'MYR'));
  assert.equal(quote?.amount, 371.99);
});

test('a fixed local price beats the converted rate, and a missing key falls back', () => {
  const config = withMyr({
    mode: 'fixed',
    fixedMonthly: { igcse_alevel: 80 },
    fixedAnnual: {},
  });
  assert.equal(quotePlan(config, 'igcse_alevel', 'monthly', 'MYR')?.amount, 80);
  assert.equal(quotePlan(config, 'igcse_alevel', 'annual', 'MYR')?.amount, roundMoney(708 * 4.7, 'charm', 'MYR'));
});

test('a disabled currency falls back to USD', () => {
  const config = withMyr({ enabled: false });
  const quote = quotePlan(config, 'igcse_alevel', 'monthly', 'MYR');
  assert.equal(quote?.currency, 'USD');
  assert.equal(quote?.amount, 79);
});

test('a null price stays null and a stored number is kept', () => {
  const kept = normalizePricing({
    plans: [{ id: 'primary_secondary', monthlyUsd: 19, annualUsd: 171, sparks: 300 }],
  });
  assert.equal(kept.plans.find(plan => plan.id === 'primary_secondary')?.monthlyUsd, 19);
  const cleared = normalizePricing({
    plans: [{ id: 'primary_secondary', monthlyUsd: null, annualUsd: null, sparks: 300 }],
    familyBundleDiscount: null,
  });
  assert.equal(cleared.plans.find(plan => plan.id === 'primary_secondary')?.monthlyUsd, null);
  assert.equal(cleared.familyBundleDiscount, null);
  assert.equal(quotePlan(cleared, 'primary_secondary', 'monthly', 'USD'), null);
});

test('display currency stays on USD unless the reader chose another', () => {
  const config = seedPricing();
  assert.equal(currencyForCountry('MY', config), 'MYR');
  assert.equal(currencyForCountry('my', config), 'MYR');
  assert.equal(currencyForCountry('US', config), 'USD');
  assert.equal(currencyForCountry('GB', config), 'GBP');
  assert.equal(currencyForCountry(null, config), 'USD');
  assert.equal(currencyForCountry('MY', withMyr({ enabled: false })), 'USD');
  assert.equal(
    resolveDisplayCurrency(config, { source: 'user', stored: 'USD', country: 'MY' }),
    'USD',
  );
  assert.equal(
    resolveDisplayCurrency(config, { source: 'auto', stored: 'USD', country: 'MY' }),
    'USD',
  );
  assert.equal(
    resolveDisplayCurrency(config, { source: 'auto', stored: 'MYR', country: 'MY' }),
    'USD',
  );
  assert.equal(
    resolveDisplayCurrency(config, { source: 'user', stored: 'GBP', country: 'MY' }),
    'GBP',
  );
  assert.equal(
    resolveDisplayCurrency(config, { source: null, stored: 'GBP', country: null }),
    'USD',
  );
});

test('a local currency is only an optional conversion beside the displayed price', () => {
  const config = seedPricing();
  const myr = optionalLocalAmount(config, 19, 'USD', 'MY');
  assert.equal(myr?.currency, 'MYR');
  assert.equal(myr?.amount, 89.99);
  assert.equal(optionalLocalAmount(config, 19, 'MYR', 'MY'), null);
  assert.equal(optionalLocalAmount(config, 19, 'USD', 'US'), null);
  assert.equal(optionalLocalAmount(config, 0, 'USD', 'MY'), null);
  assert.equal(optionalLocalAmount(config, 19, 'USD', null), null);
});

test('Stripe unit amounts use cents except for zero-decimal currencies', () => {
  assert.equal(stripeUnitAmount(19.99, 'USD'), 1999);
  assert.equal(stripeUnitAmount(89.99, 'MYR'), 8999);
  assert.equal(stripeUnitAmount(1500, 'JPY'), 1500);
  assert.equal(roundMoney(1500.4, 'charm', 'JPY'), 1500);
  assert.equal(roundMoney(0.4, 'charm', 'USD'), 0.4);
});

test('formatMoney is the single display helper', () => {
  assert.match(formatMoney(19, 'USD'), /\$19\.00/);
  assert.match(formatMoney(89.99, 'MYR'), /RM\s?89\.99/);
  assert.match(formatMoney(15.99, 'GBP'), /£15\.99/);
});

test('course prices convert through stored rates and default missing currency to USD', () => {
  const config = seedPricing();
  assert.equal(quoteCourse(config, 79, 'GBP', 'USD').amount, 100);
  assert.equal(quoteCourse(config, 79, 'GBP', 'GBP').amount, 79);
  assert.equal(quoteCourse(config, 50, undefined, 'USD').amount, 50);
  assert.equal(quoteCourse(config, 50, undefined, 'USD').currency, 'USD');
});

test('the audit diff names the fields that changed', () => {
  const before = seedPricing();
  const after = seedPricing();
  const plan = after.plans.find(item => item.id === 'primary_secondary');
  assert.ok(plan);
  plan.monthlyUsd = 29;
  after.annualDiscount = 0.2;
  const myr = after.currencies.find(item => item.code === 'MYR');
  assert.ok(myr);
  myr.rate = 4.8;
  myr.fixedMonthly = { primary_secondary: 90 };
  const lines = diffPricing(before, after);
  assert.ok(lines.some(line => line.includes('Annual discount') && line.includes('20%')));
  assert.ok(lines.some(line => line.includes('primary_secondary monthly USD unset → 29')));
  assert.ok(lines.some(line => line.includes('MYR rate 4.7 → 4.8')));
  assert.ok(lines.some(line => line.includes('primary_secondary monthly fixed')));
});

test('a book price snaps to the nearest Apple and Google .99 point', () => {
  assert.equal(snapToStorePricePoint(seedPricing().defaultBookUsd), 1.99);
  for (const point of [0.99, 1.99, 2.99, 9.99, 10.99]) {
    assert.equal(snapToStorePricePoint(point), point);
  }
  assert.equal(snapToStorePricePoint(2), 1.99);
  assert.equal(snapToStorePricePoint(2.48), 1.99);
  assert.equal(snapToStorePricePoint(2.49), 2.99);
  assert.equal(snapToStorePricePoint(5), 4.99);
  assert.equal(snapToStorePricePoint(0.01), 0.99);
  assert.equal(snapToStorePricePoint(0.49), 0.99);
  assert.equal(snapToStorePricePoint(10.4), 9.99);
  assert.equal(snapToStorePricePoint(10.49), 10.99);
  assert.equal(snapToStorePricePoint(0), 0);
  assert.equal(snapToStorePricePoint(-3), 0);
  assert.equal(snapToStorePricePoint(Number.NaN), 0);
});

test('Reads plans and the default book price come from the seed', () => {
  const config = seedPricing();
  const reads = config.plans.find(plan => plan.id === 'reads');
  const family = config.plans.find(plan => plan.id === 'reads-family');
  assert.equal(reads?.monthlyUsd, 4.99);
  assert.equal(reads?.annualUsd, 49.99);
  assert.equal(family?.monthlyUsd, 7.99);
  assert.equal(family?.annualUsd, 79.99);
  assert.equal(config.defaultBookUsd, 1.99);
  assert.equal(config.reads.find(plan => plan.id === 'reads')?.monthlyUsd, 4.99);
  const kept = normalizePricing({ ...config, defaultBookUsd: undefined, plans: config.plans.filter(plan => plan.id !== 'reads') });
  assert.equal(kept.defaultBookUsd, 1.99);
  assert.equal(kept.plans.find(plan => plan.id === 'reads')?.monthlyUsd, 4.99);
});

test('plan copy uses levels and leaves Primary and Professional unset', () => {
  const config = seedPricing();
  assert.equal(config.plans.find(plan => plan.id === 'primary_secondary')?.monthlyUsd, null);
  assert.equal(config.plans.find(plan => plan.id === 'professional')?.monthlyUsd, null);
  assert.equal(config.plans.find(plan => plan.id === 'igcse_alevel')?.monthlyUsd, 79);
  const page = readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  const plans = TIERS.flatMap(tier => [tier.name, tier.blurb, ...tier.programmes]).join('\n');
  const copy = `${plans}\n${page}`;
  assert.match(copy, /Primary & Lower Secondary/);
  assert.doesNotMatch(copy, /Primary & Secondary/);
  assert.doesNotMatch(copy, /Years?\s+\d/);
  assert.doesNotMatch(plans, /\bTiers?\b/);
  assert.doesNotMatch(copy, /Everything in Tiers?/);
  const professional = TIERS.find(tier => tier.id === 'professional');
  const lines = (professional?.programmes ?? []).join('\n');
  assert.match(lines, /MBBS Medicine/);
  assert.match(lines, /University of London \(UoL\) and other universities/);
  assert.match(lines, /Engineering — ET Engineering/);
  assert.match(lines, /Nursing — ET Nursing/);
  assert.equal(TIERS.find(tier => tier.id === 'primary_secondary')?.name, 'Primary & Lower Secondary');
  const primary = TIERS.find(tier => tier.id === 'primary_secondary');
  const igcse = TIERS.find(tier => tier.id === 'igcse_alevel');
  assert.match((primary?.programmes ?? []).join('\n'), /Poket Reads books and audiobooks/);
  assert.match((primary?.programmes ?? []).join('\n'), /ET AI Studio and ET Maths/);
  assert.match((igcse?.programmes ?? []).join('\n'), /ET AI Essay Writer — AI-graded 9-1 \/ A\*-U/);
  assert.match((igcse?.programmes ?? []).join('\n'), /Open Badges 3.0 certificates with LinkedIn sharing/);
  assert.match((igcse?.programmes ?? []).join('\n'), /Downloadable transcripts/);
  assert.match((igcse?.programmes ?? []).join('\n'), /Parent dashboard and reports/);
  assert.match((igcse?.programmes ?? []).join('\n'), /Attendance and daily goals/);
  assert.match((igcse?.programmes ?? []).join('\n'), /ET AI Live add-on/);
  assert.match((igcse?.programmes ?? []).join('\n'), /ET AI Studio, ET Maths and ET Exams/);
  assert.match(lines, /ET AI Live add-on/);
  assert.match(plans, /53 languages/);
  const preview = TIERS.find(tier => tier.id === 'preview');
  const freeLines = (preview?.programmes ?? []).join('\n');
  assert.match(freeLines, /Free digital student card/);
  assert.match(freeLines, /Free Amber alerts/);
  assert.match(page, /\[\.\.\.planProgrammes\(plan\.id\), \.\.\.plan\.features\]/);
});
