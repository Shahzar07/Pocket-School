import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOLDER_REVOCATION,
  alumniPhase,
  alumniPrice,
  alumniStats,
  completedShelf,
  defaultAlumniPolicy,
  dueToLeave,
  holderDeletion,
  openAlumni,
  parentFinalSummary,
  publicAlumniView,
  publicName,
  readAlumniPolicy,
  recommendNext,
  reviewAccess,
  seatReadyToFree,
  verifyStatusText,
} from './alumni';

test('a finished subscription stays readable and à la carte stays for life', () => {
  const shelf = completedShelf([
    { courseId: 'igcse-maths', title: 'IGCSE Mathematics', level: 'IGCSE', programmeId: 'igcse', access: 'subscription', progress: 100, passedFinal: false, institutionPaid: true },
    { courseId: 'science', title: 'Primary science', level: 'Primary', programmeId: 'primary', access: 'a_la_carte', progress: 100, passedFinal: true, institutionPaid: false },
    { courseId: 'open', title: 'Still learning', level: 'IGCSE', programmeId: 'igcse', access: 'subscription', progress: 40, passedFinal: false, institutionPaid: true },
  ], { subscriptionActive: false, institutionAccess: 'grace' });
  assert.equal(shelf.learning.length, 1);
  assert.equal(shelf.completed[0]?.review, 'read_only');
  assert.equal(shelf.completed[0]?.certificate, 'on_final_pass');
  assert.equal(shelf.completed[1]?.review, 'lifetime');
  assert.equal(shelf.completed[1]?.certificate, 'recorded');
  assert.equal(reviewAccess({ access: 'subscription', institutionPaid: true, subscriptionActive: true, institutionAccess: 'ended' }), 'ended');
});

test('the next level can be enrolled or sent to the academy', () => {
  const recs = recommendNext({
    level: 'IGCSE',
    finishedIds: ['igcse-maths'],
    atInstitution: true,
    options: [
      { id: 'igcse-maths', title: 'IGCSE Mathematics', level: 'IGCSE', programmeId: 'igcse', access: 'subscription' },
      { id: 'alevel-maths', title: 'A-Level Mathematics', level: 'A-Level', programmeId: 'alevel', access: 'subscription' },
      { id: 'alevel-lab', title: 'A-Level lab pack', level: 'A-Level', programmeId: 'alevel', access: 'a_la_carte' },
    ],
  });
  assert.equal(recs[0]?.action, 'ask_school');
  assert.equal(recs[1]?.action, 'enrol');
  assert.equal(recommendNext({ level: 'Professional', finishedIds: [], atInstitution: false, options: recs.map((row) => ({ ...row, programmeId: '', access: 'subscription' as const })) }).length, 0);
});

test('leaving opens a 30-day alumni grace and then frees the seat', () => {
  const person = openAlumni({
    policy: defaultAlumniPolicy(),
    today: '2026-10-17',
    studentId: 'stu-1',
    schoolStudentId: 'S-14',
    name: 'Ada Lovelace',
    studentNumber: 'PS-ABCD-2345',
    email: 'ada@school.edu.my',
    institutionId: 'north',
    institutionName: 'North Academy',
    level: 'Professional',
    reason: 'final_level',
    certificates: 2,
  });
  assert.equal(person.graceEndsOn, '2026-11-16');
  assert.equal(alumniPhase(person, '2026-11-01'), 'grace');
  assert.equal(seatReadyToFree(person, '2026-11-16'), true);
  assert.equal(dueToLeave({ role: 'student', status: 'joined', level: 'Professional', endDate: '', today: '2026-10-17', yearEnd: true }).reason, 'final_level');
  assert.equal(dueToLeave({ role: 'student', status: 'joined', level: 'IGCSE', endDate: '2026-10-01', today: '2026-10-17', yearEnd: false }).reason, 'end_date');
  assert.equal(dueToLeave({ role: 'parent', status: 'joined', level: 'IGCSE', endDate: '2026-10-01', today: '2026-10-17', yearEnd: true }).leave, false);
  const saved = readAlumniPolicy({ graceDays: 10, discount: 0.2, newsletter: true, placeholder: false });
  assert.equal(saved.graceDays, 10);
  assert.equal(saved.placeholder, false);
});

test('the public profile is opt-in and the deletion phrase stays on the verify page', () => {
  assert.equal(publicName('Ada Lovelace'), 'Ada L.');
  assert.equal(publicAlumniView({ optIn: false, name: 'Ada Lovelace', studentNumber: 'PS-ABCD-2345', institutionName: 'North', level: 'Professional', certificates: ['IGCSE Mathematics'], badges: 3 }), null);
  const view = publicAlumniView({ optIn: true, name: 'Ada Lovelace', studentNumber: 'PS-ABCD-2345', institutionName: 'North', level: 'Professional', certificates: ['IGCSE Mathematics'], badges: 3 });
  assert.equal(view?.name, 'Ada L.');
  assert.equal('email' in (view ?? {}), false);
  const stats = alumniStats([{ leftOn: '2026-10-17', certificates: 2 }, { leftOn: '2025-06-01', certificates: 1 }]);
  assert.equal(stats.alumni, 2);
  assert.equal(stats.certificates, 3);
  assert.equal(stats.byYear[1]?.graduates, 1);
  assert.equal(alumniPrice(20, 0.15).monthly, 17);
  assert.match(parentFinalSummary({ institutionName: 'North Academy', childName: 'Ada', level: 'Professional', certificates: 2 }).body, /final Parent Explainer/);
  assert.equal(holderDeletion().pageLive, true);
  assert.equal(verifyStatusText('revoked', HOLDER_REVOCATION), HOLDER_REVOCATION);
  assert.equal(verifyStatusText('valid', ''), 'Valid');
});
