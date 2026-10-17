import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_WORK } from '../hotline/policy';
import {
  FIND_CONTACT,
  SCHOOL_INFORMED,
  addWorkingDays,
  needsOffPlatformNotice,
  noticeConsent,
  noticeEscalationDue,
  noticeReminderDue,
  noticeSummary,
  schoolNoticeMessage,
  verifiedSchoolEmail,
} from './school-notice';

const monday = Date.parse('2026-10-19T01:00:00Z');

test('a school on Poket School does not use the off-platform notice', () => {
  assert.equal(needsOffPlatformNotice({ name: 'North Academy', onPoket: true }), false);
  assert.equal(needsOffPlatformNotice({ name: 'River School', onPoket: false }), true);
  assert.equal(needsOffPlatformNotice({ name: 'A', onPoket: false }), false);
});

test('consent is the student at 13+, a guardian under 13, or a reasoned override', () => {
  assert.equal(noticeConsent({
    ageTier: 'teen', studentConsent: true, guardianConsent: false, guardianExcluded: false, seriousRisk: false, overrideReason: '',
  }).ok, true);
  assert.equal(noticeConsent({
    ageTier: 'under13', studentConsent: true, guardianConsent: false, guardianExcluded: false, seriousRisk: false, overrideReason: '',
  }).ok, false);
  const guardian = noticeConsent({
    ageTier: 'under13', studentConsent: false, guardianConsent: true, guardianExcluded: false, seriousRisk: false, overrideReason: '',
  });
  assert.equal(guardian.ok && guardian.consentBy, 'guardian');
  assert.equal(noticeConsent({
    ageTier: 'under13', studentConsent: false, guardianConsent: true, guardianExcluded: true, seriousRisk: false, overrideReason: '',
  }).ok, false);
  const override = noticeConsent({
    ageTier: 'under13', studentConsent: false, guardianConsent: false, guardianExcluded: true, seriousRisk: true, overrideReason: 'Immediate harm',
  });
  assert.equal(override.ok && override.consentBy, 'desk_override');
  assert.equal(noticeConsent({
    ageTier: 'teen', studentConsent: false, guardianConsent: false, guardianExcluded: false, seriousRisk: true, overrideReason: 'short',
  }).ok, false);
});

test('an email is kept only when the official page contains it', () => {
  const page = 'Write to the office at safeguarding@river.example on this page.';
  const kept = verifiedSchoolEmail({
    email: 'safeguarding@river.example',
    sourceUrl: 'https://river.example/contact',
    pageText: page,
  });
  assert.equal(kept.ok, true);
  assert.equal(verifiedSchoolEmail({
    email: 'head@river.example',
    sourceUrl: 'https://river.example/contact',
    pageText: page,
  }).ok, false);
  assert.equal(verifiedSchoolEmail({
    email: 'safeguarding@river.example',
    sourceUrl: 'http://river.example/contact',
    pageText: page,
  }).ok, false);
  const missing = verifiedSchoolEmail({ email: '', sourceUrl: '', pageText: '' });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.task, 'find_contact');
  assert.equal(FIND_CONTACT, 'Find contact');
});

test('the notice names the incident and hides the reporter', () => {
  assert.equal(noticeSummary('Messages on another app', 'Amina Rahim').ok, true);
  assert.equal(noticeSummary('Amina Rahim was targeted', 'Amina Rahim').ok, false);
  const message = schoolNoticeMessage({
    schoolName: 'River School',
    incidentType: 'bullying',
    dates: 'October 2026',
    summary: 'Messages on another app',
    ackUrl: 'https://poketschool.ai/school-notice/abc',
    joinUrl: 'https://poketschool.ai/signup?help=bullying&ref=POKETSTAND',
    evidenceAttached: true,
  });
  assert.equal(message.text.includes('Amina'), false);
  assert.equal(message.text.includes('Incident type: bullying'), true);
  assert.equal(message.text.includes('safety@poketschool.ai'), true);
  assert.equal(message.text.includes('/school-notice/abc'), true);
  assert.equal(message.text.includes('free'), true);
  assert.equal(message.html.includes('<script'), false);
});

test('reminders wait 3 working days and escalation waits 7', () => {
  const reminded = addWorkingDays(monday, 3, DEFAULT_WORK);
  const escalated = addWorkingDays(monday, 7, DEFAULT_WORK);
  assert.equal(new Date(reminded).toISOString().slice(0, 10), '2026-10-22');
  assert.equal(new Date(escalated).toISOString().slice(0, 10), '2026-10-28');
  assert.equal(noticeReminderDue(monday, 0, 0, reminded - 1), false);
  assert.equal(noticeReminderDue(monday, 0, 0, reminded), true);
  assert.equal(noticeReminderDue(monday, reminded, 0, escalated), false);
  assert.equal(noticeEscalationDue(monday, 0, 0, escalated), true);
  assert.equal(noticeEscalationDue(monday, escalated, 0, escalated), false);
  assert.equal(SCHOOL_INFORMED, 'Your school has been informed');
});
