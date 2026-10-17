import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CODE_ATTEMPT_LIMIT,
  CODE_LOCKOUT_MS,
  TOKEN_STEP_MS,
  ageBandFor,
  canPublishAmberAlerts,
  categoriesBlockedForMinors,
  codeDecision,
  displayStanding,
  isPartnerMerchant,
  issuePaceAllowed,
  nextCodeFailure,
  nextStandingRecord,
  offerVisible,
  publicVerification,
  reviewOffer,
  standingFor,
  standingLabel,
} from './model';
import { readStudentToken, signStudentToken } from './token';

const secret = 'test-card-secret';
const now = 1_700_000_000_000;

test('the QR token rotates every 30 seconds and stays verifiable', () => {
  const issued = signStudentToken('user-1', now, secret);
  const read = readStudentToken(issued.token, now + 1000, secret);
  assert.equal(read?.uid, 'user-1');
  assert.equal(read?.active, true);
  assert.equal(read?.validUntil, issued.validUntil);
  assert.equal(issued.validUntil - now <= TOKEN_STEP_MS, true);
  const later = signStudentToken('user-1', now + TOKEN_STEP_MS, secret);
  assert.notEqual(later.token, issued.token);
  const stale = readStudentToken(issued.token, now + TOKEN_STEP_MS + 1, secret);
  assert.equal(stale?.active, false);
  assert.equal(readStudentToken(issued.token, now + TOKEN_STEP_MS * 2 + 1, secret), null);
  assert.equal(readStudentToken(issued.token, now + 1000, 'other-secret'), null);
  assert.equal(issued.token.includes('PS-1042'), false);
});

test('a checkout code locks after repeated failures', () => {
  assert.equal(codeDecision(null, now, false), 'missing');
  assert.equal(codeDecision({ attempts: 1, lockedUntil: 0, validUntil: now + 1000 }, now, true), 'ok');
  assert.equal(codeDecision({ attempts: 1, lockedUntil: 0, validUntil: now - 1 }, now, true), 'expired');
  const locked = nextCodeFailure(CODE_ATTEMPT_LIMIT - 1, now);
  assert.equal(locked.lockedUntil, now + CODE_LOCKOUT_MS);
  assert.equal(codeDecision({ attempts: locked.attempts, lockedUntil: locked.lockedUntil, validUntil: now + 1000 }, now, true), 'locked');
  assert.equal(issuePaceAllowed([now, now, now, now, now], now), false);
  assert.equal(issuePaceAllowed([now - 120_000], now), true);
});

test('verified student needs a paid tier and a seat or enrolment', () => {
  assert.equal(standingFor({ tier: 1, seatActive: true, enrolled: false }), 'verified');
  assert.equal(standingFor({ tier: 2, seatActive: false, enrolled: true }), 'verified');
  assert.equal(standingFor({ tier: 0, seatActive: true, enrolled: true }), 'member');
  assert.equal(standingFor({ tier: 3, seatActive: false, enrolled: false }), 'member');
  assert.equal(standingLabel('verified'), 'Verified Poket School student');
  assert.equal(standingLabel('member'), 'Member');
  const kept = nextStandingRecord('verified', { status: 'verified', verifiedAt: 10, validUntil: 20 }, now);
  assert.equal(kept.verifiedAt, 10);
  assert.equal(displayStanding({ status: 'verified', validUntil: now - 1 }, now), 'member');
});

test('the public face hides date of birth, school, and the student number', () => {
  const adult = publicVerification({
    name: 'Amina Rahman',
    ageTier: 'adult',
    avatarUrl: 'https://example.com/a.jpg',
    standing: 'verified',
    active: true,
    validUntil: now + 1000,
  });
  assert.equal(adult.firstName, 'Amina');
  assert.equal(adult.ageBand, '18+');
  assert.equal(adult.showPhoto, true);
  assert.equal('dateOfBirth' in adult, false);
  assert.equal('schoolName' in adult, false);
  assert.equal('studentNumber' in adult, false);
  const child = publicVerification({
    name: 'Noah',
    ageTier: 'under13',
    avatarUrl: 'https://example.com/secret.jpg',
    standing: 'member',
    active: false,
    validUntil: now,
  });
  assert.equal(child.showPhoto, false);
  assert.equal(child.avatarUrl, '');
  assert.equal(child.ageBand, '<18');
  assert.equal(child.label, 'Member');
  assert.equal(ageBandFor('teen'), '<18');
});

test('minors never see age-gated or blocked offers', () => {
  const live = {
    status: 'live',
    ageMin: 0,
    countries: ['MY'],
    cities: [] as string[],
    startsAt: now - 10,
    endsAt: now + 10,
    categories: ['food'],
  };
  const minor = { minor: true, country: 'MY', city: '' };
  assert.equal(offerVisible(live, minor, now), true);
  assert.equal(offerVisible({ ...live, ageMin: 16 }, minor, now), false);
  assert.equal(offerVisible({ ...live, categories: ['alcohol'] }, minor, now), false);
  assert.equal(offerVisible({ ...live, categories: ['vape'] }, { minor: false, country: 'MY', city: '' }, now), true);
  assert.equal(offerVisible({ ...live, countries: ['GB'] }, minor, now), false);
  assert.equal(categoriesBlockedForMinors(['Food', 'tobacco']), true);
  assert.equal(reviewOffer(['alcohol'], 18).ok, true);
  assert.equal(reviewOffer(['gambling'], 16).ok, false);
  assert.match(reviewOffer(['adult'], 0).reason, /under-18s/);
});

test('a partner merchant cannot publish Amber alerts', () => {
  assert.equal(isPartnerMerchant({ role: 'partner_merchant' }), true);
  assert.equal(isPartnerMerchant({ role: 'student', roles: ['partner_merchant'] }), true);
  assert.equal(canPublishAmberAlerts('partner_merchant'), false);
  assert.equal(canPublishAmberAlerts('police'), true);
  assert.equal(canPublishAmberAlerts('ngo'), true);
  assert.equal(canPublishAmberAlerts('student'), false);
});
