import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DELETION_GRACE_MS,
  PRIVILEGED_PROFILE_FIELDS,
  SELF_SERVICE_FIELDS,
  deletionClosed,
  deletionPending,
  formatDeletionDate,
  normalisePayout,
  passwordAcceptable,
  passwordStrength,
  profilePatch,
  scheduleDeletion,
  sessionRevoked,
} from './account-settings';

test('password strength rises as the password gains length, case, a digit, and a symbol', () => {
  assert.equal(passwordStrength('').label, 'Enter a password');
  assert.equal(passwordStrength('short').score, 0);
  assert.equal(passwordAcceptable('short'), false);
  assert.equal(passwordAcceptable('Longer1'), false);
  const strong = passwordStrength('Poket-School-2026');
  assert.equal(strong.label, 'Strong');
  assert.equal(passwordAcceptable('Poket-School-2026'), true);
});

test('account deletion waits fourteen days and can be told apart from a closed account', () => {
  const now = Date.UTC(2026, 9, 15);
  const request = scheduleDeletion(now);
  assert.equal(request.scheduledFor - request.requestedAt, DELETION_GRACE_MS);
  assert.equal(deletionPending(request, now + 1000), true);
  assert.equal(deletionClosed(request, now + 1000), false);
  assert.equal(deletionClosed(request, request.scheduledFor), true);
  assert.match(formatDeletionDate(request), /2026/);
});

test('a profile save never includes privileged fields', () => {
  const patch = profilePatch({
    name: 'Amina Yusuf',
    displayName: 'Amina',
    bio: 'Year 8 science',
    country: 'Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    phone: '+60123456789',
    language: 'en',
    currency: 'myr',
    avatarUrl: '',
    photoStoragePath: '',
    level: 'secondary',
    learningStyle: 'visual',
    yearGroup: 'Year 8',
    notificationPrefs: { email: true, push: false, messages: true, announcements: true, product: false, alumni: true, institution: true, achievements: true },
    privacy: { shareBoard: false, profilePublic: true, showEmail: false },
    twoFactorEnabled: true,
    instructor: { headline: 'Science', bio: 'Labs', public: true },
  }, 'student');
  assert.equal(patch.country, 'MY');
  assert.equal(patch.currency, 'MYR');
  assert.equal(patch.shareBoard, false);
  assert.equal(patch.level, 'Lower Secondary');
  assert.equal(patch.yearGroup, 'Lower Secondary');
  assert.equal('instructor' in patch, false);
  for (const field of PRIVILEGED_PROFILE_FIELDS) {
    assert.equal(field in patch, false, field);
  }
  const teacher = profilePatch({
    name: 'Ms Lee',
    displayName: 'Ms Lee',
    bio: '',
    country: 'Malaysia',
    timezone: 'Asia/Kuala_Lumpur',
    phone: '',
    language: 'en',
    currency: 'USD',
    avatarUrl: 'https://example.com/a.jpg',
    photoStoragePath: 'media/teacher/a.jpg',
    level: '',
    learningStyle: '',
    yearGroup: '',
    notificationPrefs: { email: true, push: true, messages: true, announcements: true, product: true, alumni: false, institution: true, achievements: true },
    privacy: { shareBoard: true, profilePublic: true, showEmail: false },
    twoFactorEnabled: false,
    instructor: { headline: '  Physics  ', bio: 'Public bio', public: true },
  }, 'teacher');
  assert.deepEqual(teacher.instructor, { headline: 'Physics', bio: 'Public bio', public: true });
});

test('self-service fields and privileged fields do not overlap', () => {
  const privileged = new Set<string>(PRIVILEGED_PROFILE_FIELDS);
  for (const field of SELF_SERVICE_FIELDS) {
    assert.equal(privileged.has(field), false, field);
  }
});

test('payout details keep only the last four digits', () => {
  assert.deepEqual(normalisePayout({
    method: 'bank',
    email: ' pay@poketschool.ai ',
    accountName: ' Amina ',
    bankName: ' Maybank ',
    accountLast4: '12-345678',
  }), {
    method: 'bank',
    email: 'pay@poketschool.ai',
    accountName: 'Amina',
    bankName: 'Maybank',
    accountLast4: '5678',
  });
});

test('a session started before sign-out-everywhere is revoked', () => {
  assert.equal(sessionRevoked(200, 100), true);
  assert.equal(sessionRevoked(100, 200), false);
  assert.equal(sessionRevoked(undefined, 100), false);
});
