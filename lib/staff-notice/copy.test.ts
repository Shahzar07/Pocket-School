import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deliveryExtra,
  fallbackChannel,
  headPost,
  lockScreenName,
  lockScreenNotice,
  noticeCategory,
  staffRecipients,
} from './copy';

test('the lock screen names the student, class, and time, and nothing else', () => {
  const notice = lockScreenNotice({
    typeLabel: 'Danger now',
    fullName: 'Aisha Rahman',
    classLabel: '5 Amanah',
    at: Date.UTC(2026, 9, 17, 4, 30),
  });
  assert.equal(notice.title, 'Danger now');
  assert.equal(notice.body, 'Aisha R. · 5 Amanah · 12:30. Open case.');
  assert.equal(notice.body.includes('012'), false);
  assert.equal(notice.body.includes('@'), false);
  assert.equal(notice.body.includes('pushed at the gate'), false);
  assert.equal(lockScreenName('Aisha'), 'Aisha');
  assert.equal(lockScreenName(''), 'A student');
  const unnamed = lockScreenNotice({ typeLabel: '', fullName: '', classLabel: '', at: Date.UTC(2026, 9, 17, 4, 30) });
  assert.equal(unnamed.title, 'Safeguarding');
  assert.equal(unnamed.body, 'School · 12:30. Open case.');
});

test('staff recipients drop parents and duplicates', () => {
  assert.deepEqual(staffRecipients({
    formTeacherUid: 'teacher-1',
    headUids: ['lead-1', 'teacher-1'],
    principalUids: ['principal-1', 'parent-1'],
    parentUids: ['parent-1', 'parent-2'],
  }), ['teacher-1', 'lead-1', 'principal-1']);
});

test('safety reports stay on the safety category and other notices are emergencies', () => {
  assert.equal(noticeCategory('student_safety_report'), 'safety');
  assert.equal(noticeCategory('danger_now'), 'emergency');
  assert.equal(noticeCategory('safeguarding_ticket'), 'emergency');
  assert.equal(noticeCategory('emergency_alert'), 'emergency');
});

test('the head is the safeguarding lead except for operational alerts', () => {
  assert.equal(headPost('danger_now'), 'safeguarding_lead');
  assert.equal(headPost('student_safety_report'), 'safeguarding_lead');
  assert.equal(headPost('safeguarding_ticket'), 'safeguarding_lead');
  assert.equal(headPost('emergency_alert', 'missing_child'), 'safeguarding_lead');
  assert.equal(headPost('emergency_alert', 'medical'), 'safeguarding_lead');
  assert.equal(headPost('emergency_alert', 'lockdown'), 'academic_lead');
  assert.equal(headPost('emergency_alert', 'weather'), 'academic_lead');
  assert.equal(headPost('emergency_alert', 'general'), 'academic_lead');
});

test('a failed channel falls back to the one that was sent', () => {
  assert.equal(fallbackChannel(true, false), 'email');
  assert.equal(fallbackChannel(false, true), 'push');
  assert.equal(fallbackChannel(true, true), '');
  assert.equal(fallbackChannel(false, false), '');
  const extra = deliveryExtra({
    channel: 'email',
    recipientUid: 'lead-1',
    status: 'sent',
    provider: 'resend',
    providerId: 'email_1',
    fallback: 'email',
  });
  assert.deepEqual(Object.keys(extra).sort(), ['channel', 'error', 'fallback', 'provider', 'providerId', 'recipientUid', 'status']);
  assert.equal(JSON.stringify(extra).includes('phone'), false);
});
