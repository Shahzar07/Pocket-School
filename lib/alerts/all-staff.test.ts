import assert from 'node:assert/strict';
import test from 'node:test';
import { pushBypassesQuietHours } from '../push';
import {
  canWidenAllStaff,
  checkInProblem,
  defaultInstruction,
  instructionText,
  languageOf,
  rollCallCounts,
  staffAlertView,
  widenProblem,
} from './all-staff';

test('only a tier 3 principal or safeguarding lead can widen to all staff', () => {
  assert.equal(canWidenAllStaff('principal', 3), true);
  assert.equal(canWidenAllStaff('safeguarding_lead', 4), true);
  assert.equal(canWidenAllStaff('principal', 2), false);
  assert.equal(canWidenAllStaff('teacher', 3), false);
  assert.equal(canWidenAllStaff('academic_lead', 3), false);
  assert.equal(canWidenAllStaff('principal', 0), false);
  assert.equal(widenProblem({
    staffPost: 'principal',
    verificationTier: 3,
    type: 'lockdown',
    location: 'Hall',
    reason: 'ab',
  }), 'Widening needs a reason.');
  assert.equal(widenProblem({
    staffPost: 'principal',
    verificationTier: 3,
    type: 'lockdown',
    location: 'Hall',
    reason: 'Door forced',
  }), null);
});

test('the staff view drops the report, the evidence, and the child', () => {
  const view = staffAlertView({
    id: 'alert-1',
    type: 'lockdown',
    location: 'Block B',
    instruction: 'Stay in the room.',
    status: 'open',
    publicDescription: 'Aisha, year 5, blue backpack',
    childName: 'Aisha Rahman',
    body: 'Pushed at the gate',
    evidence: ['file-1'],
    studentId: 'student-9',
  });
  const encoded = JSON.stringify(view);
  assert.equal(view.publicDescription, '');
  assert.equal(encoded.includes('Aisha'), false);
  assert.equal(encoded.includes('Pushed'), false);
  assert.equal(encoded.includes('file-1'), false);
  assert.equal(encoded.includes('student-9'), false);
  assert.equal(view.location, 'Block B');
  const missing = staffAlertView({
    id: 'alert-2',
    type: 'missing_child_on_site',
    location: 'Field',
    instruction: 'Search your area.',
    status: 'open',
    publicDescription: 'Blue backpack near the field',
    childName: 'Aisha Rahman',
  });
  assert.equal(missing.publicDescription, 'Blue backpack near the field');
  assert.equal(JSON.stringify(missing).includes('Aisha'), false);
});

test('roll-call counts safe, need help, and no response', () => {
  const counts = rollCallCounts(
    ['a', 'b', 'c', 'd'],
    [{ uid: 'a', status: 'safe' }, { uid: 'b', status: 'need_help' }],
  );
  assert.deepEqual(counts, { safe: 1, needHelp: 1, noResponse: 2 });
  assert.equal(checkInProblem('cleared', 'safe'), 'Roll-call is closed.');
  assert.equal(checkInProblem('open', 'safe'), null);
});

test('instructions follow the staff language and a school can edit one language', () => {
  assert.equal(languageOf('zh-Hant'), 'zh');
  assert.equal(languageOf('zh-TW'), 'zh');
  assert.equal(languageOf('ms-MY'), 'ms');
  assert.equal(languageOf('ta'), 'ta');
  assert.equal(languageOf(''), 'en');
  assert.match(defaultInstruction('fire_evacuation', 'ms'), /Keluar/);
  const edited = instructionText('medical', { en: 'Send for Nurse Lim.' }, 'en');
  assert.equal(edited, 'Send for Nurse Lim.');
  assert.equal(instructionText('medical', { en: 'Send for Nurse Lim.' }, 'ms').includes('Nurse'), false);
});

test('an emergency push bypasses quiet hours', () => {
  assert.equal(pushBypassesQuietHours('emergency'), true);
  assert.equal(pushBypassesQuietHours('safety'), false);
  assert.equal(pushBypassesQuietHours('hotline'), false);
});
