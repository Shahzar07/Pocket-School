import assert from 'node:assert/strict';
import test from 'node:test';
import { alertPerson, hotlinePosts, resolveRecipients, type AlertPerson } from './recipients';

function person(partial: Partial<AlertPerson> & { uid: string }): AlertPerson {
  return alertPerson({ institutionId: 'school-1', role: 'teacher', ...partial });
}

const school = [
  person({ uid: 'lead', staffPost: 'safeguarding_lead' }),
  person({ uid: 'principal', staffPost: 'principal' }),
  person({ uid: 'form', staffPost: 'teacher' }),
  person({ uid: 'academic', staffPost: 'academic_lead' }),
  person({ uid: 'other', staffPost: 'teacher' }),
  person({ uid: 'admin-local', role: 'institution_admin', staffPost: '' }),
  person({ uid: 'pupil', role: 'student', staffPost: '' }),
  person({ uid: 'mum', role: 'parent', staffPost: '' }),
  person({ uid: 'dad', role: 'parent', staffPost: '' }),
];

test('a safety report goes to the lead, the principal, the form teacher, and linked parents', () => {
  const resolved = resolveRecipients({
    kind: 'student_safety_report',
    institutionId: 'school-1',
    people: school,
    formTeacherUid: 'form',
    parentUids: ['mum', 'dad'],
    exclusion: { type: 'bullying', who: 'a classmate', concernRole: 'student', dontTellParents: false },
  });
  assert.deepEqual(resolved.staffUids, ['lead', 'principal', 'form']);
  assert.deepEqual(resolved.parentUids, ['mum', 'dad']);
  assert.equal(resolved.uids.includes('academic'), false);
  assert.equal(resolved.uids.includes('other'), false);
  assert.equal(resolved.uids.includes('admin-local'), false);
  assert.equal(resolved.parentsExcluded, false);
});

test('danger uses the same staff and drops parents when the exclusion rule applies', () => {
  const abuse = resolveRecipients({
    kind: 'danger_now',
    institutionId: 'school-1',
    people: school,
    formTeacherUid: 'form',
    parentUids: ['mum', 'dad'],
    exclusion: { type: 'abuse', who: '', concernRole: '', dontTellParents: false },
  });
  assert.deepEqual(abuse.parentUids, []);
  assert.deepEqual(abuse.staffUids, ['lead', 'principal', 'form']);
  assert.equal(abuse.parentsExcluded, true);
  const named = resolveRecipients({
    kind: 'danger_now',
    institutionId: 'school-1',
    people: school,
    formTeacherUid: 'form',
    parentUids: ['mum'],
    exclusion: { type: 'bullying', who: 'my dad', concernRole: 'student', dontTellParents: false },
  });
  assert.deepEqual(named.parentUids, []);
  const opted = resolveRecipients({
    kind: 'student_safety_report',
    institutionId: 'school-1',
    people: school,
    formTeacherUid: 'form',
    parentUids: ['mum'],
    parentsExcluded: true,
  });
  assert.deepEqual(opted.parentUids, []);
});

test('a parent who is only an academic lead is not extra staff', () => {
  const people = [
    ...school,
    person({ uid: 'mum', role: 'parent', staffPost: 'academic_lead' }),
  ];
  const resolved = resolveRecipients({
    kind: 'student_safety_report',
    institutionId: 'school-1',
    people,
    formTeacherUid: 'form',
    parentUids: ['mum'],
    exclusion: { type: 'bullying', who: '', concernRole: 'student', dontTellParents: false },
  });
  assert.equal(resolved.staffUids.includes('mum'), false);
  assert.deepEqual(resolved.parentUids, ['mum']);
});

test('a hotline ticket reaches the addressed post and the escalation chain', () => {
  assert.deepEqual(hotlinePosts('teacher', false), ['teacher', 'academic_lead', 'principal']);
  assert.deepEqual(hotlinePosts('principal', true), ['principal', 'safeguarding_lead']);
  const ordinary = resolveRecipients({
    kind: 'hotline',
    institutionId: 'school-1',
    people: school,
    addressedTo: 'teacher',
    addressedUid: 'form',
    sensitive: false,
  });
  assert.deepEqual(ordinary.uids.sort(), ['academic', 'form', 'other', 'principal']);
  assert.equal(ordinary.uids.includes('lead'), false);
  assert.equal(ordinary.parentUids.length, 0);
  const sensitive = resolveRecipients({
    kind: 'hotline',
    institutionId: 'school-1',
    people: school,
    addressedTo: 'principal',
    sensitive: true,
  });
  assert.deepEqual(sensitive.uids.sort(), ['lead', 'principal']);
});

test('amber and emergency alerts reach the school and opted-in outsiders', () => {
  const people = [
    ...school,
    person({
      uid: 'neighbour',
      institutionId: '',
      role: 'parent',
      country: 'Malaysia',
      state: 'Selangor',
      city: 'Petaling Jaya',
      emergencyOptIn: true,
    }),
    person({
      uid: 'silent',
      institutionId: '',
      role: 'parent',
      country: 'Malaysia',
      state: 'Selangor',
      city: 'Petaling Jaya',
      emergencyOptIn: false,
    }),
    person({
      uid: 'abroad',
      institutionId: 'other-school',
      role: 'student',
      homeCountry: 'MY',
      emergencyOptIn: true,
    }),
    person({
      uid: 'tourist',
      institutionId: '',
      role: 'parent',
      country: 'Singapore',
      homeCountry: 'SG',
      emergencyOptIn: true,
    }),
  ];
  const resolved = resolveRecipients({
    kind: 'amber',
    institutionId: 'school-1',
    people,
    region: { country: 'Malaysia', state: 'Selangor', city: 'Petaling Jaya' },
  });
  for (const uid of ['lead', 'principal', 'form', 'academic', 'other', 'admin-local', 'pupil', 'mum', 'dad']) {
    assert.equal(resolved.communityUids.includes(uid), true, uid);
  }
  assert.deepEqual(resolved.optedInUids.sort(), ['abroad', 'neighbour']);
  assert.equal(resolved.uids.includes('silent'), false);
  assert.equal(resolved.uids.includes('tourist'), false);
  const emergency = resolveRecipients({
    kind: 'emergency',
    institutionId: 'school-1',
    people,
    region: { country: 'Malaysia', state: '', city: '' },
  });
  assert.equal(emergency.optedInUids.includes('neighbour'), true);
});

test('a safety desk case keeps super admins, the primary, escalated backup, and tier-2 guardians', () => {
  const people = [
    person({ uid: 'super', role: 'admin', institutionId: '', staffPost: '' }),
    person({ uid: 'mum', role: 'parent', verificationTier: 2 }),
    person({ uid: 'uncle', role: 'parent', verificationTier: 1 }),
  ];
  const quiet = resolveRecipients({
    kind: 'safety_desk',
    institutionId: '',
    people,
    primaryUid: 'primary',
    backupUid: 'backup',
    guardianUids: ['mum', 'uncle'],
    guardianTiers: { mum: 2, uncle: 1 },
    parentUids: ['mum'],
    escalate: false,
    exclusion: { type: 'bullying', who: '', concernRole: 'student', dontTellParents: false },
  });
  assert.deepEqual(quiet.uids, ['super', 'primary', 'mum']);
  const escalated = resolveRecipients({
    kind: 'safety_desk',
    institutionId: '',
    people,
    primaryUid: 'primary',
    backupUid: 'backup',
    guardianUids: ['mum'],
    guardianTiers: { mum: 2 },
    parentUids: ['mum'],
    escalate: true,
    exclusion: { type: 'abuse', who: '', concernRole: '', dontTellParents: false },
  });
  assert.deepEqual(escalated.uids, ['super', 'primary', 'backup']);
  assert.equal(escalated.parentsExcluded, true);
});

test('all-staff is every staff member at the school and nobody else', () => {
  const resolved = resolveRecipients({
    kind: 'all_staff',
    institutionId: 'school-1',
    people: [
      ...school,
      person({ uid: 'visitor', institutionId: 'school-2', staffPost: 'teacher' }),
    ],
  });
  assert.deepEqual(resolved.uids.sort(), ['academic', 'admin-local', 'form', 'lead', 'other', 'principal']);
  assert.equal(resolved.uids.includes('pupil'), false);
  assert.equal(resolved.uids.includes('mum'), false);
});
