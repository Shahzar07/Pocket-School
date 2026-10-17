import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OFFER_BUNDLE_EXTRAS, offerIncludedFeatures, offerPlans, offerPublicStrings } from './offer';

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
  assert.equal(reads?.price, 'Coming soon');
  assert.equal(reads?.price.includes('$'), false);
});
