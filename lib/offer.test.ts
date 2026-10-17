import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFER_BUNDLE_EXTRAS, OFFER_ROUTES, offerIncludedFeatures, offerPlans, offerPublicStrings } from './offer';
import { booksVersusUnlimitedLine, ownOrReadLine, readsPlanItem } from './payments/reads';

const FORBIDDEN = [
  /\bPROPOSED\b/i,
  /\bSUGGESTED\b/i,
  /\bTBD\b/i,
  /\bPocket\b/,
  /\bLyra\b/,
  /\bUdemy\b/i,
  /\bCoursera\b/i,
  /\bET\b(?!\s+(AI|Maths|Physics|English|Biology|Economics|Exams)\b)/,
  /\bYears?\s+\d/i,
];

test('offer copy never uses internal or off-brand wording', () => {
  const strings = offerPublicStrings();
  assert.ok(strings.length > 20);
  for (const line of strings) {
    for (const pattern of FORBIDDEN) {
      assert.equal(pattern.test(line), false, `${pattern} matched: ${line}`);
    }
  }
});

test('bundle extras follow OFFER_BUNDLE_EXTRAS and default on', () => {
  assert.equal(OFFER_BUNDLE_EXTRAS, true);
  const on = offerPlans(true).find((plan) => plan.id === 'all-in');
  const off = offerPlans(false).find((plan) => plan.id === 'all-in');
  assert.ok(on?.features.includes('Poket Reads included'));
  assert.ok(on?.features.includes('1-week ET AI Live taster'));
  assert.equal(off?.features.includes('Poket Reads included'), false);
  assert.equal(off?.features.includes('1-week ET AI Live taster'), false);

  const readsOn = offerIncludedFeatures(true).some((feature) => feature.title === 'Poket Reads');
  const readsOff = offerIncludedFeatures(false).some((feature) => feature.title === 'Poket Reads');
  assert.equal(readsOn, true);
  assert.equal(readsOff, false);

  const reads = offerPlans(true).find((plan) => plan.id === 'reads');
  const month = readsPlanItem('reads', 'month');
  const year = readsPlanItem('reads', 'year');
  const familyMonth = readsPlanItem('reads-family', 'month');
  const familyYear = readsPlanItem('reads-family', 'year');
  assert.ok(month && year && familyMonth && familyYear);
  assert.equal(reads?.price, `$${month.unitAmount.toFixed(2)}/mo`);
  assert.equal(reads?.priceNote, `$${year.unitAmount.toFixed(2)}/yr`);
  assert.equal(reads?.tagline, ownOrReadLine());
  assert.equal(reads?.href, '/reads/offer');
  assert.equal(reads?.href, OFFER_ROUTES.reads);
  assert.equal(reads?.features.includes(booksVersusUnlimitedLine()), true);
  assert.equal(reads?.features.includes(`Reads Family $${familyMonth.unitAmount.toFixed(2)}/mo or $${familyYear.unitAmount.toFixed(2)}/yr`), true);
  assert.equal(reads?.price.includes('Coming soon'), false);
  assert.equal(offerPublicStrings().some((line) => line === 'Coming soon'), false);
});
