import assert from 'node:assert/strict';
import test from 'node:test';
import { canDirectMessage } from '../network/policy';
import { resolveRecipients, alertPerson } from '../alerts/recipients';
import {
  CHECK_IN_DELAYS_MS,
  DESK_SLA_MS,
  NOT_A_COUNSELLOR,
  OFFICIAL_HELPLINES,
  bullyingReceiveAllowed,
  canSeeEvidence,
  checkInDue,
  checkInTimes,
  commentVisible,
  criticalNeedsEscalation,
  deskDueAt,
  evidenceHash,
  falseReportReview,
  guardianIdsFor,
  helpNearMe,
  helplinesForCountry,
  outreachPaused,
  repeatedReportLimits,
  reportRateFlag,
  riskSeverity,
  schoolReferralPayload,
  supportResponse,
} from './policy';

test('anti-bullying help ignores every access tier', () => {
  assert.equal(bullyingReceiveAllowed(), true);
  assert.equal(bullyingReceiveAllowed(0), true);
  assert.equal(bullyingReceiveAllowed(3), true);
});

test('a person with no school is routed to the Safety Desk, and an anonymous report stays there', () => {
  const people = [alertPerson({ uid: 'super', role: 'admin' })];
  const desk = resolveRecipients({
    kind: 'bullying',
    institutionId: '',
    people,
    primaryUid: 'primary',
    backupUid: 'backup',
    guardianUids: ['mum', 'uncle'],
    guardianTiers: { mum: 2, uncle: 1 },
    exclusion: { type: 'bullying', who: '', concernRole: '', dontTellParents: false },
  });
  assert.deepEqual(desk.uids, ['super', 'primary', 'mum']);
  assert.equal(desk.parentUids.includes('uncle'), false);

  const hidden = resolveRecipients({
    kind: 'bullying',
    institutionId: 'school-1',
    anonymous: true,
    people,
    primaryUid: 'primary',
    guardianUids: ['mum'],
    guardianTiers: { mum: 2 },
    parentUids: ['mum'],
    exclusion: { type: 'abuse', who: '', concernRole: '', dontTellParents: false },
  });
  assert.equal(hidden.parentsExcluded, true);
  assert.equal(hidden.parentUids.includes('mum'), false);
  assert.equal(hidden.staffUids.includes('super'), true);
});

test('a named school report still reaches the safeguarding lead', () => {
  const resolved = resolveRecipients({
    kind: 'bullying',
    institutionId: 'school-1',
    people: [
      alertPerson({ uid: 'lead', institutionId: 'school-1', staffPost: 'safeguarding_lead', role: 'teacher' }),
      alertPerson({ uid: 'stranger', institutionId: 'school-2', staffPost: 'safeguarding_lead', role: 'teacher' }),
    ],
    formTeacherUid: 'form',
    parentUids: ['mum'],
    exclusion: { type: 'bullying', who: '', concernRole: 'student', dontTellParents: false },
  });
  assert.deepEqual(resolved.staffUids.sort(), ['form', 'lead']);
  assert.deepEqual(resolved.parentUids, ['mum']);
});

test('desk SLAs and critical escalation use the config clock', () => {
  assert.equal(DESK_SLA_MS.critical, 15 * 60 * 1000);
  assert.equal(deskDueAt(1_000, 'high') - 1_000, DESK_SLA_MS.high);
  assert.equal(criticalNeedsEscalation(0, 0, 0, DESK_SLA_MS.critical - 1), false);
  assert.equal(criticalNeedsEscalation(0, 0, 0, DESK_SLA_MS.critical), true);
  assert.equal(criticalNeedsEscalation(0, 10, 0, DESK_SLA_MS.critical + 1), false);
});

test('check-ins are due at 24 hours and 7 days', () => {
  const times = checkInTimes(0);
  assert.deepEqual(times, [...CHECK_IN_DELAYS_MS]);
  assert.equal(checkInDue(times[0], 0, times[0] - 1), false);
  assert.equal(checkInDue(times[0], 0, times[0]), true);
  assert.equal(checkInDue(times[1], 5, times[1] + 10), false);
});

test('helplines are the official Malaysia lines, and an unknown country is empty', () => {
  const lines = helplinesForCountry('Malaysia');
  assert.equal(lines.length, OFFICIAL_HELPLINES.length);
  assert.equal(lines.every(line => line.sourceUrl.startsWith('https://')), true);
  assert.equal(lines.some(line => line.number === '15999'), true);
  assert.equal(helplinesForCountry('Narnia').length, 0);
  assert.equal(helpNearMe('Malaysia')?.emergencyNumber, '999');
  assert.equal(helpNearMe('Narnia'), null);
});

test('a risk phrase is critical and the chat is not a counsellor', () => {
  assert.equal(riskSeverity('I want to die'), 'critical');
  assert.equal(riskSeverity('someone was mean in class'), 'none');
  const night = Date.parse('2026-10-17T18:30:00Z');
  const answer = supportResponse('I want to die', 'Malaysia', night);
  assert.equal(answer.severity, 'critical');
  assert.equal(answer.showHelplines, true);
  assert.equal(answer.showHelpNearMe, true);
  assert.equal(answer.label, NOT_A_COUNSELLOR);
});

test('rate limits and false reports flag a review and do not punish the reporter', () => {
  assert.deepEqual(reportRateFlag(3), { flagged: true, refused: false });
  assert.equal(reportRateFlag(1).refused, false);
  assert.deepEqual(falseReportReview(2), { review: true, punish: false });
  assert.equal(repeatedReportLimits(3).dmLimited, true);
  assert.equal(repeatedReportLimits(3).connectionLimited, true);
  assert.equal(outreachPaused({ dmLimited: true }, 'dm').ok, false);
  assert.equal(outreachPaused({ connectionLimited: false }, 'connection').ok, true);
});

test('restrict hides a comment from everyone except the author, the post owner, and the Desk', () => {
  const base = { authorId: 'bully', postAuthorId: 'victim', restrictedByPostAuthor: true, deskLead: false };
  assert.equal(commentVisible({ ...base, viewerId: 'classmate' }), false);
  assert.equal(commentVisible({ ...base, viewerId: 'bully' }), true);
  assert.equal(commentVisible({ ...base, viewerId: 'victim' }), true);
  assert.equal(commentVisible({ ...base, viewerId: 'desk', deskLead: true }), true);
});

test('adults cannot direct-message an under-18', () => {
  const adult = {
    id: 'a',
    ageTier: 'adult' as const,
    role: 'student',
    institutionId: '',
    classIds: [] as string[],
    handle: 'a',
    visibility: 'network' as const,
    openToWork: 'no' as const,
    shareContact: false,
    searchable: true,
    blockedIds: [] as string[],
  };
  const teen = { ...adult, id: 't', ageTier: 'teen' as const, handle: 't' };
  assert.equal(canDirectMessage(adult, teen, true).ok, false);
});

test('the evidence hash is stable and guardians see it only when they are not excluded', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hash = evidenceHash('a note', bytes, 10);
  assert.equal(hash, evidenceHash('a note', bytes, 10));
  assert.notEqual(hash, evidenceHash('a note', bytes, 11));
  assert.equal(canSeeEvidence({ id: 'me', role: 'student', staffPost: '' }, { ownerId: 'me', guardianIds: [], parentsExcluded: false }), true);
  assert.equal(canSeeEvidence({ id: 'mum', role: 'parent', staffPost: '' }, { ownerId: 'me', guardianIds: ['mum'], parentsExcluded: false }), true);
  assert.equal(canSeeEvidence({ id: 'mum', role: 'parent', staffPost: '' }, { ownerId: 'me', guardianIds: ['mum'], parentsExcluded: true }), false);
  assert.equal(canSeeEvidence({ id: 'desk', role: 'admin', staffPost: '' }, { ownerId: 'me', guardianIds: [], parentsExcluded: true }), true);
  const guardians = guardianIdsFor({
    under18: true,
    links: [{ parentId: 'mum', status: 'approved', tier: 2 }, { parentId: 'uncle', status: 'approved', tier: 1 }],
    exclusion: { type: 'bullying', who: '', concernRole: '', dontTellParents: false },
  });
  assert.deepEqual(guardians.ids, ['mum']);
});

test('a school referral needs consent and never carries the reporter', () => {
  assert.equal(schoolReferralPayload({ bullySchoolId: 'north', consent: false, where: 'online', summary: 'Messages on Instagram' }).ok, false);
  const sent = schoolReferralPayload({ bullySchoolId: 'north', consent: true, where: 'online', summary: 'Messages on Instagram' });
  assert.equal(sent.ok, true);
  if (sent.ok) {
    assert.equal(sent.payload.reporterHidden, true);
    assert.equal('reporterUid' in sent.payload, false);
  }
});
