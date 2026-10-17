import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHORITY_DECISION_REQUIRED,
  AUTHORITY_SEND_REQUIRED,
  OFFICIAL_AUTHORITY_CHANNELS,
  authorityCaseMessage,
  authorityCaseRequired,
  authorityCloseMessage,
  channelsFor,
  mandatoryReportingNote,
  partnerEligible,
  referralFamily,
  referredForTracker,
} from './authority-referral';

test('a high or critical case needs an authority decision before it closes', () => {
  assert.equal(authorityCaseRequired({ deskSeverity: 'high', safetyType: 'bullying', text: '' }), true);
  assert.equal(authorityCaseRequired({ deskSeverity: 'low', safetyType: 'unsafe_other', text: 'nothing urgent' }), false);
  assert.equal(authorityCaseRequired({ deskSeverity: 'low', safetyType: 'unsafe_other', text: 'He threatened assault' }), true);
  const open = authorityCloseMessage({
    source: 'student_safety_report',
    safetyType: 'bullying',
    deskSeverity: 'high',
    text: '',
    required: 'unsure',
    status: 'to_be_informed',
    closing: true,
  });
  assert.equal(open, AUTHORITY_DECISION_REQUIRED);
  const waiting = authorityCloseMessage({
    source: 'student_safety_report',
    safetyType: 'bullying',
    deskSeverity: 'high',
    text: '',
    required: 'yes',
    status: 'to_be_informed',
    closing: true,
  });
  assert.equal(waiting, AUTHORITY_SEND_REQUIRED);
  const done = authorityCloseMessage({
    source: 'student_safety_report',
    safetyType: 'bullying',
    deskSeverity: 'high',
    text: '',
    required: 'no',
    status: 'not_required',
    closing: true,
  });
  assert.equal(done, null);
  const hotline = authorityCloseMessage({
    source: 'parent_hotline',
    safetyType: '',
    deskSeverity: '',
    text: '',
    required: 'unsure',
    status: 'to_be_informed',
    closing: true,
  });
  assert.equal(hotline, null);
});

test('official channels come from checked pages and never include an email', () => {
  const malaysia = channelsFor('Malaysia', 'bullying at school');
  assert.equal(malaysia.some(row => row.agency === 'Royal Malaysia Police'), true);
  assert.equal(malaysia.some(row => row.phone === '15999'), true);
  assert.equal(malaysia.some(row => row.kind === 'scam'), false);
  const extortion = channelsFor('MY', 'This is sextortion');
  assert.equal(extortion.some(row => row.phone === '997'), true);
  assert.equal(channelsFor('France', 'assault').length, 0);
  for (const row of OFFICIAL_AUTHORITY_CHANNELS) {
    assert.equal(row.sourceUrl.startsWith('https://'), true);
    assert.equal(row.how.includes('@'), false);
    assert.equal(row.agency.includes('@'), false);
  }
  assert.equal(malaysia.some(row => row.how.toLowerCase().includes('e-reporting site is for a lost item')), true);
});

test('a sexual case in Malaysia carries the checked mandatory-reporting note', () => {
  const note = mandatoryReportingNote('Malaysia', 'sexual exploitation');
  assert.match(note.note, /Talian Kasih/);
  assert.equal(note.sourceUrl.startsWith('https://'), true);
  assert.equal(mandatoryReportingNote('Malaysia', 'name calling').note, '');
  assert.equal(mandatoryReportingNote('Kenya', 'sexual').note, '');
});

test('the student is told unless that would put them at risk, and an abusive parent is not told', () => {
  const normal = referralFamily({ parentsExcluded: false, abuseByParent: false, withholdStudent: false, withholdReason: '' });
  assert.equal(normal.ok && normal.tellStudent && normal.tellGuardians && normal.trackerVisible, true);
  const abuse = referralFamily({ parentsExcluded: true, abuseByParent: true, withholdStudent: false, withholdReason: '' });
  assert.equal(abuse.ok && abuse.tellGuardians, false);
  assert.equal(abuse.ok && abuse.trackerVisible, true);
  const hidden = referralFamily({ parentsExcluded: true, abuseByParent: true, withholdStudent: true, withholdReason: 'short' });
  assert.equal(hidden.ok, false);
  const withheld = referralFamily({ parentsExcluded: true, abuseByParent: true, withholdStudent: true, withholdReason: 'Parent would punish them' });
  assert.equal(withheld.ok && withheld.trackerVisible, false);
  assert.equal(referredForTracker(false, 10), false);
  assert.equal(referredForTracker(true, 10), true);
});

test('a tier-4 police or child-protection partner in the country can receive the case', () => {
  assert.equal(partnerEligible({
    tier: 4, partnerKind: 'police', country: 'Malaysia', region: 'Selangor', wantedCountry: 'MY', wantedRegion: 'Selangor',
  }), true);
  assert.equal(partnerEligible({
    tier: 3, partnerKind: 'police', country: 'Malaysia', region: '', wantedCountry: 'Malaysia', wantedRegion: '',
  }), false);
  assert.equal(partnerEligible({
    tier: 4, partnerKind: 'school', country: 'Malaysia', region: '', wantedCountry: 'Malaysia', wantedRegion: '',
  }), false);
  const message = authorityCaseMessage({
    agency: 'Royal Malaysia Police',
    incidentType: 'bullying',
    dates: '12 October 2026',
    summary: 'A student was threatened.',
    caseUrl: 'https://poketschool.ai/authority-case/abc',
  });
  assert.equal(message.text.includes('Amina'), false);
  assert.match(message.text, /not named/);
  assert.match(message.text, /does not replace emergency services/);
});
