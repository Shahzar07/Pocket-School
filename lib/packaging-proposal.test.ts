import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { TIERS, CONTENT_MIN_TIER } from './entitlements';
import { FORMAT_COSTS } from './sparks';
import { READS_PLANS } from './payments/reads';

const root = fileURLToPath(new URL('..', import.meta.url));

test('300 Sparks is the primary allowance and a full lesson is 100', () => {
  const primary = TIERS.find((tier) => tier.id === 'primary_secondary');
  assert.equal(primary?.sparks, 300);
  assert.equal(primary?.sparksRollover, 100);
  const fullLesson = Object.values(FORMAT_COSTS).reduce((sum, cost) => sum + cost, 0);
  assert.equal(fullLesson, 100);
  assert.equal(CONTENT_MIN_TIER.BOOK, 0);
  assert.equal(READS_PLANS[0]?.usd, 4.99);
});

test('the proposal answers both packaging questions without changing numbers', () => {
  const doc = readFileSync(`${root}/docs/PACKAGING_PROPOSAL.md`, 'utf8');
  assert.match(doc, /Keep 300/);
  assert.match(doc, /top-up packs/);
  assert.match(doc, /Include Poket Reads in every paid subscription/);
  assert.match(doc, /standalone/);
  assert.match(doc, /\$4\.99/);
  assert.match(doc, /does not edit `lib\/entitlements\.ts`/);
});
