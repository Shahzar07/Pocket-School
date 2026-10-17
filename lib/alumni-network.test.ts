import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attendanceLink,
  campaignMail,
  canDirectMessage,
  channelOpen,
  defaultConsent,
  directoryEntry,
  groupIdFor,
  matchesAudience,
  mentorDecision,
  renderTemplate,
  scheduleReady,
  screenPost,
} from './alumni-network';

const person = {
  leftOn: '2026-06-01',
  level: 'Professional',
  programme: 'Business',
  className: 'Oak',
  country: 'Malaysia',
  destination: 'University of Oxford',
};

test('a cohort filter keeps the matching alumni and drops the rest', () => {
  assert.equal(matchesAudience(person, { year: '2026', level: '', programme: '', className: '', country: '', destination: '' }), true);
  assert.equal(matchesAudience(person, { year: '2025', level: 'Professional', programme: 'Business', className: 'Oak', country: 'Malaysia', destination: 'Oxford' }), false);
  assert.equal(matchesAudience(person, { year: '', level: 'Professional', programme: '', className: 'Oak', country: '', destination: 'oxford' }), true);
  assert.equal(matchesAudience({ ...person, destination: '' }, { year: '', level: '', programme: '', className: '', country: '', destination: 'Oxford' }), false);
});

test('unsubscribe stops email and push and leaves the inbox choice alone', () => {
  const consent = { ...defaultConsent(), email: true, push: true, unsubscribed: true, inbox: true };
  assert.equal(channelOpen(consent, 'email'), false);
  assert.equal(channelOpen(consent, 'push'), false);
  assert.equal(channelOpen(consent, 'inbox'), true);
  assert.equal(channelOpen(defaultConsent(), 'email'), false);
  assert.equal(channelOpen({ ...defaultConsent(), inbox: false }, 'inbox'), false);
});

test('the reunion template and the mail both carry an unsubscribe path', () => {
  const note = renderTemplate('reunion', 'North Academy', 'Bring a name badge.');
  assert.match(note.subject, /North Academy/);
  assert.match(note.body, /name badge/);
  const mail = campaignMail({
    academy: 'North Academy',
    subject: note.subject,
    body: note.body,
    viewUrl: 'https://poketschool.ai/api/alumni/open?kind=open',
    eventUrl: 'https://poketschool.ai/api/alumni/open?kind=click',
    unsubscribeUrl: 'https://poketschool.ai/api/alumni/unsubscribe?token=abc',
  });
  assert.match(mail.text, /Unsubscribe from North Academy/);
  assert.match(mail.text, /class history stays/);
});

test('a class link costs no seat', () => {
  const link = attendanceLink();
  assert.equal(link.seatCounted, false);
  assert.equal(link.holdsSeat, false);
});

test('class and cohort groups are named from the class or the level', () => {
  assert.deepEqual(groupIdFor({ className: 'Oak', level: 'IGCSE', year: '2026' }).id, 'class-oak-2026');
  assert.equal(groupIdFor({ className: '', level: 'A-Level', year: '2026' }).id, 'cohort-a-level-2026');
});

test('a scheduled note waits for its date', () => {
  assert.equal(scheduleReady('2026-10-17', '2026-10-17'), true);
  assert.equal(scheduleReady('2026-10-18', '2026-10-17'), false);
  assert.equal(scheduleReady('', '2026-10-17'), false);
});

test('minors cannot send a direct message', () => {
  const adult = { id: 'ada', ageTier: 'adult' as const, messages: true };
  const teen = { id: 'sam', ageTier: 'teen' as const, messages: true };
  assert.equal(canDirectMessage(adult, { id: 'grace', ageTier: 'adult', messages: true }, false), true);
  assert.equal(canDirectMessage(adult, teen, false), false);
  assert.equal(canDirectMessage(adult, { id: 'grace', ageTier: 'adult', messages: false }, false), false);
  assert.equal(canDirectMessage(adult, { id: 'grace', ageTier: 'adult', messages: true }, true), false);
  assert.equal(canDirectMessage(adult, adult, false), false);
});

test('a minor class post is held for a moderator and a threat is blocked', () => {
  const held = screenPost('See you at the reunion.', 'teen');
  assert.equal(held.decision, 'hold');
  assert.equal(held.visible, false);
  assert.equal(held.queued, true);
  const allowed = screenPost('See you at the reunion.', 'adult');
  assert.equal(allowed.visible, true);
  const blocked = screenPost('I will kill the plan', 'adult');
  assert.equal(blocked.decision, 'block');
  assert.equal(blocked.visible, false);
  assert.equal(blocked.queued, false);
});

test('mentorship stays closed until the academy approves, and a minor thread is moderated', () => {
  const pending = mentorDecision({
    mentorAdult: true,
    mentorOptIn: true,
    studentOptIn: true,
    institutionApproved: false,
    studentMinor: true,
  });
  assert.equal(pending.open, false);
  assert.equal(pending.pending, true);
  assert.equal(pending.moderated, true);
  const open = mentorDecision({
    mentorAdult: true,
    mentorOptIn: true,
    studentOptIn: true,
    institutionApproved: true,
    studentMinor: false,
  });
  assert.equal(open.open, true);
  assert.equal(open.moderated, false);
  assert.equal(mentorDecision({
    mentorAdult: false,
    mentorOptIn: true,
    studentOptIn: true,
    institutionApproved: true,
    studentMinor: false,
  }).open, false);
});

test('the directory shows a public name and hides anyone who opted out', () => {
  assert.equal(directoryEntry({ directory: false, name: 'Ada Lovelace', level: 'Professional', className: 'Oak', destination: 'Oxford' }), null);
  assert.deepEqual(directoryEntry({ directory: true, name: 'Ada Lovelace', level: 'Professional', className: 'Oak', destination: 'Oxford' }), {
    name: 'Ada L.',
    level: 'Professional',
    className: 'Oak',
    destination: 'Oxford',
  });
  assert.equal(directoryEntry({ directory: true, name: 'ada@school.edu', level: '', className: '', destination: '' }), null);
});
