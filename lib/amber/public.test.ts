import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_ALERT } from '../emergency/sample';
import { regionMatch, type EmergencyRecord } from '../emergency/policy';
import {
  AMBER_JOIN_CTA,
  SAMPLE_AMBER_CODE,
  amberJoinPath,
  amberOptInPatch,
  amberPage,
  amberPublishRefusal,
  amberPushBody,
  amberReceiveAllowed,
  amberReferralPath,
  amberShareAccent,
  amberSignupFields,
  canPublishAmber,
} from './public';

function record(overrides: Partial<EmergencyRecord> = {}): EmergencyRecord {
  return {
    ...SAMPLE_ALERT,
    id: 'alert-1',
    subjectName: 'Aisha Rahman',
    description: 'Internal note naming the class and the form teacher.',
    publicDescription: 'Last seen near the north gate in a blue shirt.',
    publicApproval: { name: false, photo: false, description: true },
    referralCode: 'AMINARAH12',
    photoUrl: 'https://example.com/photo.jpg',
    guardianConsent: true,
    ...overrides,
  };
}

test('publishing is a tier 3 principal or a tier 4 partner', () => {
  assert.equal(canPublishAmber({ tier: 3, staffPost: 'principal' }), true);
  assert.equal(canPublishAmber({ tier: 4, staffPost: 'teacher' }), true);
  assert.equal(canPublishAmber({ tier: 4, staffPost: '' }), true);
  assert.equal(canPublishAmber({ tier: 0, staffPost: 'principal' }), false);
  assert.equal(canPublishAmber({ tier: 2, staffPost: 'principal' }), false);
  assert.equal(canPublishAmber({ tier: 3, staffPost: 'teacher' }), false);
  assert.equal(canPublishAmber({ tier: 3, staffPost: 'safeguarding_lead' }), false);
  assert.match(amberPublishRefusal({ tier: 0, staffPost: 'principal' }) ?? '', /tier 3 principal or a tier 4 partner/);
  assert.equal(amberPublishRefusal({ tier: 3, staffPost: 'principal' }), null);
});

test('receiving an Amber alert ignores every subscription tier', () => {
  assert.equal(amberReceiveAllowed(), true);
  assert.equal(amberReceiveAllowed(0), true);
  assert.equal(amberReceiveAllowed(6), true);
});

test('the public page keeps unapproved child details, the reporter, and hotline data off', () => {
  const view = amberPage(record());
  assert.ok(view);
  assert.equal(view.subjectName, '');
  assert.equal(view.photoUrl, '');
  assert.equal(view.description, 'Last seen near the north gate in a blue shirt.');
  assert.equal(view.title, 'Missing child');
  assert.equal(view.joinCta, AMBER_JOIN_CTA);
  assert.equal(view.referralCode, 'AMINARAH12');
  assert.equal(view.joinPath, '/signup?amber=1&ref=AMINARAH12');
  assert.equal(amberReferralPath(view.referralCode), 'referrals/AMINARAH12');
  assert.equal(view.city, 'Kuala Lumpur');
  assert.equal(view.agency.includes('Police'), true);
  const dumped = JSON.stringify(view);
  assert.equal(dumped.includes('Aisha'), false);
  assert.equal(dumped.includes('form teacher'), false);
  assert.equal(dumped.includes('publishedBy'), false);
  assert.equal(dumped.includes('hotline'), false);
  assert.equal(dumped.includes('principal'), false);
});

test('an approved name and photo are the only extra child details', () => {
  const hidden = amberPage(record({ publicApproval: { name: true, photo: true, description: false }, guardianConsent: false }));
  assert.equal(hidden?.subjectName, 'Aisha Rahman');
  assert.equal(hidden?.photoUrl, '');
  assert.equal(hidden?.description, '');
  const shown = amberPage(record({ publicApproval: { name: true, photo: true, description: true } }));
  assert.equal(shown?.photoUrl.includes('photo'), true);
  assert.equal(amberPushBody(shown!, record().region).includes('north gate'), true);
  const generic = amberPage(record({ publicApproval: { name: true, photo: false, description: false } }));
  assert.equal(amberPushBody(generic!, record().region), 'Missing child alert in Kuala Lumpur');
});

test('resolved and redacted pages say resolved and drop the details', () => {
  for (const overrides of [
    { status: 'resolved' as const },
    { status: 'closed' as const },
    { status: 'retracted' as const },
    { publicRedacted: true },
    { consentWithdrawn: true },
  ]) {
    const view = amberPage(record(overrides));
    assert.equal(view?.resolved, true);
    assert.equal(view?.title, 'resolved');
    assert.equal(view?.description, '');
    assert.equal(view?.subjectName, '');
    assert.equal(view?.photoUrl, '');
    assert.equal(view?.city, '');
    assert.equal(view?.agency, '');
    assert.equal(view?.referenceNumber, '');
    assert.equal(view?.shareEnabled, false);
    assert.equal(view?.noindex, true);
    assert.equal(view?.joinCta, AMBER_JOIN_CTA);
  }
  assert.equal(amberPage(record({ status: 'draft' })), null);
  assert.equal(amberPage(record({ type: 'lockdown' })), null);
});

test('signup can opt in with no school, and the join link carries the code', () => {
  assert.deepEqual(amberSignupFields({ optIn: true, country: 'MY', state: 'Kuala Lumpur', referral: 'AMINARAH12' }), {
    referredBy: 'AMINARAH12',
    emergencyOptIn: true,
    homeCountry: 'MY',
    state: 'Kuala Lumpur',
  });
  assert.deepEqual(amberSignupFields({ optIn: false, country: 'MY' }), {});
  assert.equal(amberSignupFields({ optIn: true, country: '' }).emergencyOptIn, undefined);
  const patch = amberOptInPatch({ country: 'MY', state: 'Selangor' });
  assert.equal(patch.ok, true);
  if (patch.ok) {
    assert.equal(patch.patch.emergencyOptIn, true);
    assert.equal(patch.patch.homeCountry, 'MY');
    assert.equal('institutionId' in patch.patch, false);
    assert.equal('accessTier' in patch.patch, false);
  }
  assert.equal(amberOptInPatch({ country: ' ' }).ok, false);
  assert.equal(amberJoinPath(SAMPLE_AMBER_CODE), '/signup?amber=1&ref=POKETAMBER');
  assert.equal(amberShareAccent(), '#3FE0D0');
});

test('a country code matches the region name used on an alert', () => {
  assert.equal(regionMatch(
    { country: 'MY', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
    { country: 'Malaysia', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  ), true);
  assert.equal(regionMatch(
    { country: 'US', state: '', city: '' },
    { country: 'Malaysia', state: '', city: '' },
  ), false);
});

test('the sample card is a free Amber page with the sample referral code', () => {
  const view = amberPage({
    ...SAMPLE_ALERT,
    publicDescription: SAMPLE_ALERT.description,
    publicApproval: { name: false, photo: false, description: true },
    referralCode: SAMPLE_AMBER_CODE,
  });
  assert.equal(view?.subjectName, '');
  assert.equal(view?.description.includes('north gate'), true);
  assert.equal(view?.referralCode, SAMPLE_AMBER_CODE);
  assert.equal(amberReferralPath(SAMPLE_AMBER_CODE), 'referrals/POKETAMBER');
});
