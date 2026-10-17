import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MEMBER_CARD_TITLE,
  STUDENT_CARD_TITLE,
  firstName,
  issuedNumber,
  joinPath,
  publicCard,
  redeemDecision,
  referralCodeFromBytes,
  streakDays,
  withRedemption,
  type CardSource,
} from './model';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function source(overrides: Partial<CardSource> = {}): CardSource {
  return {
    name: 'Amina Rahman',
    level: 'Year 10',
    pathway: '',
    institutionId: '',
    institutionName: 'Rochford',
    ageTier: 'teen',
    avatarUrl: 'https://example.com/photo.jpg',
    studyDates: ['2026-10-15', '2026-10-16', '2026-10-17'],
    badges: ['Algebra', 'Essay'],
    referralCode: 'amina2k7',
    cardIndexed: true,
    cardSharing: false,
    revoked: false,
    ...overrides,
  };
}

test('member numbers use PSM- and school numbers keep the PS- format', () => {
  assert.equal(issuedNumber(false, 42), 'PSM-0042');
  assert.equal(issuedNumber(true, 1042), 'PS-1042');
  assert.throws(() => issuedNumber(false, 0));
});

test('a person without a school gets the Poket School member card', () => {
  const card = publicCard(source(), '2026-10-17');
  assert.equal(card.title, MEMBER_CARD_TITLE);
  assert.equal(card.firstName, 'Amina');
  assert.equal(card.levelName, 'IGCSE');
  assert.equal(card.schoolName, null);
  assert.equal(card.streakDays, 3);
  assert.equal(card.joinPath, '/signup?ref=AMINA2K7');
  assert.equal(card.indexable, false);
  assert.equal(card.visible, true);
  assert.equal(card.showPhoto, true);
  assert.equal('studentNumber' in card, false);
  assert.equal('qr' in card, false);
  assert.equal('dateOfBirth' in card, false);
});

test('adults at a school can show the school and choose indexing', () => {
  const card = publicCard(source({
    ageTier: 'adult',
    institutionId: 'school-1',
    cardIndexed: true,
  }), '2026-10-17');
  assert.equal(card.title, STUDENT_CARD_TITLE);
  assert.equal(card.schoolName, 'Rochford');
  assert.equal(card.indexable, true);
});

test('under-18 cards stay noindex and hide the school', () => {
  const teen = publicCard(source({
    ageTier: 'teen',
    institutionId: 'school-1',
    cardIndexed: true,
  }), '2026-10-17');
  assert.equal(teen.schoolName, null);
  assert.equal(teen.indexable, false);
});

test('under-13 cards are an avatar, need a parent, and stay noindex', () => {
  const blocked = publicCard(source({
    ageTier: 'under13',
    name: 'Mina',
    institutionId: 'school-1',
    cardIndexed: true,
    cardSharing: false,
  }), '2026-10-17');
  assert.equal(blocked.visible, false);
  assert.equal(blocked.showPhoto, false);
  assert.equal(blocked.avatarUrl, '');
  assert.equal(blocked.schoolName, null);
  assert.equal(blocked.indexable, false);

  const shared = publicCard(source({
    ageTier: 'under13',
    cardSharing: true,
    cardIndexed: true,
  }), '2026-10-17');
  assert.equal(shared.visible, true);
  assert.equal(shared.showPhoto, false);
  assert.equal(shared.indexable, false);
});

test('a revoked share is not visible and not indexed', () => {
  const card = publicCard(source({ ageTier: 'adult', cardIndexed: true, revoked: true }), '2026-10-17');
  assert.equal(card.visible, false);
  assert.equal(card.indexable, false);
});

test('referral redemption is a stub with no reward', () => {
  const record = { inviterUid: 'owner', createdAt: 1, redeemedBy: [] };
  assert.equal(redeemDecision(record, 'owner'), 'self');
  assert.equal(redeemDecision(null, 'new'), 'missing');
  const next = withRedemption(record, 'new', 10);
  assert.deepEqual(next.redeemedBy, [{ uid: 'new', at: 10 }]);
  assert.equal(redeemDecision(next, 'new'), 'already');
  assert.equal(withRedemption(next, 'new', 11), next);
  assert.equal(referralCodeFromBytes(new Uint8Array(8).fill(1)).length, 8);
  assert.equal(joinPath('nope'), '/signup');
});

test('the streak stops on the first missing day', () => {
  assert.equal(streakDays(['2026-10-17', '2026-10-15'], '2026-10-17'), 1);
  assert.equal(firstName('  '), 'Member');
});

test('card routes do not consult entitlements', () => {
  const server = readFileSync(path.join(root, 'lib/cards/server.ts'), 'utf8');
  const route = readFileSync(path.join(root, 'app/api/card/route.ts'), 'utf8');
  const page = readFileSync(path.join(root, 'app/card/[shareId]/page.tsx'), 'utf8');
  for (const sourceText of [server, route, page]) {
    assert.equal(/entitlement|accessTier|subscriptionTier|paywall/i.test(sourceText), false);
  }
});
