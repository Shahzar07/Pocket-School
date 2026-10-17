import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bypassesQuietHours,
  canConfirm,
  canCreate,
  emergencyNumber,
  emergencySeverity,
  publicView,
  regionMatch,
  type EmergencyRecord,
} from './policy';

function record(overrides: Partial<EmergencyRecord> = {}): EmergencyRecord {
  return {
    id: 'alert-1',
    institutionId: 'school-1',
    type: 'missing_child',
    title: 'Missing child',
    description: 'Last seen near the school gate.',
    subjectName: 'A student',
    region: { country: 'Malaysia', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
    photoUrl: 'https://example.com/photo.jpg',
    guardianConsent: true,
    consentId: 'consent-1',
    authoritiesInformed: { agency: 'Royal Malaysia Police', referenceNumber: 'PDRM-1044', informedAt: 1 },
    authorities: {
      required: 'yes',
      reason: '',
      status: 'informed',
      informed: { agency: 'Royal Malaysia Police', contact: '999', reference: 'PDRM-1044', at: 1, by: 'principal-1' },
    },
    status: 'active',
    publishedBy: 'principal-1',
    publishedAt: 1,
    confirmedBy: 'lead-1',
    confirmedAt: 2,
    resolved: null,
    publicShareEnabled: true,
    sharePaused: false,
    reviewEveryMs: 24 * 60 * 60 * 1000,
    reviewDueAt: 3,
    retractedReason: '',
    ogVersion: 1,
    counts: { views: 0, shares: 0 },
    ...overrides,
  };
}

test('a second verified staff member confirms, and a missing child needs the police reference', () => {
  assert.equal(canCreate('admin', '', false), true);
  assert.equal(canCreate('teacher', 'teacher', true), false);
  assert.equal(canCreate('institution_admin', 'principal', true), true);
  assert.equal(canConfirm({
    publisherId: 'principal-1',
    confirmerId: 'principal-1',
    confirmerVerified: true,
    type: 'missing_child',
    authorities: true,
    consentOnFile: true,
  }), 'A second staff member has to confirm this alert.');
  assert.equal(canConfirm({
    publisherId: 'principal-1',
    confirmerId: 'lead-1',
    confirmerVerified: true,
    type: 'missing_child',
    authorities: false,
    consentOnFile: true,
  }), 'Tell the authorities before a missing child alert is published.');
  assert.equal(canConfirm({
    publisherId: 'principal-1',
    confirmerId: 'lead-1',
    confirmerVerified: true,
    type: 'missing_child',
    authorities: true,
    consentOnFile: false,
  }), 'A guardian consent record is required before this alert is published.');
  assert.equal(canConfirm({
    publisherId: 'principal-1',
    confirmerId: 'lead-1',
    confirmerVerified: true,
    type: 'missing_child',
    authorities: true,
    consentOnFile: true,
  }), null);
});

test('region match, severity, and the Malaysia emergency number', () => {
  assert.equal(regionMatch(
    { country: 'Malaysia', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
    { country: 'Malaysia', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  ), true);
  assert.equal(regionMatch(
    { country: 'Malaysia', state: 'Selangor', city: 'Petaling Jaya' },
    { country: 'Malaysia', state: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  ), false);
  assert.equal(emergencySeverity('lockdown'), 'critical');
  assert.equal(bypassesQuietHours('weather'), true);
  assert.equal(bypassesQuietHours('general'), true);
  assert.equal(emergencyNumber('Malaysia'), '999');
  assert.equal(emergencyNumber('US'), '911');
});

test('a resolved alert drops the name and photo and turns sharing off', () => {
  const open = publicView(record());
  assert.equal(open?.photoUrl.includes('photo'), true);
  assert.equal(open?.shareEnabled, true);
  const closed = publicView(record({
    status: 'resolved',
    resolved: { by: 'lead-1', at: 3, outcome: 'Found safe', authoritiesClosed: true },
  }));
  assert.equal(closed?.subjectName, '');
  assert.equal(closed?.photoUrl, '');
  assert.equal(closed?.shareEnabled, false);
  assert.equal(closed?.noindex, true);
  assert.match(closed?.disclaimer ?? '', /999/);
  assert.equal(publicView(record({ status: 'draft' })), null);
  const paused = publicView(record({ sharePaused: true, publicShareEnabled: false }));
  assert.equal(paused?.shareEnabled, false);
  assert.equal(paused?.noindex, false);
  const retracted = publicView(record({ status: 'retracted', retractedReason: 'Wrong school' }));
  assert.equal(retracted?.subjectName, '');
  assert.equal(retracted?.photoUrl, '');
  assert.equal(retracted?.shareEnabled, false);
  assert.equal(retracted?.noindex, true);
  assert.match(retracted?.description ?? '', /retracted/);
  const waiting = publicView(record({
    authorities: { required: 'yes', reason: '', status: 'to_be_informed', informed: null },
    publicShareEnabled: true,
  }));
  assert.equal(waiting?.shareEnabled, false);
});
