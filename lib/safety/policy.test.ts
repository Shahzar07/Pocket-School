import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSeeReporter,
  cleanHelplines,
  dangerFanOut,
  dangerNeedsEscalation,
  dangerRepeatFlag,
  DANGER_ACK_MS,
  helplinesFor,
  placeOnce,
  needsUrgentLeadNotice,
  parentsExcluded,
  safetyRateFlag,
  safetyView,
  trackerFor,
} from './policy';

const parents = [
  { parentId: 'parent-a', status: 'approved' },
  { parentId: 'parent-b', status: 'approved' },
  { parentId: 'parent-pending', status: 'pending' },
];
const staff = ['lead-1', 'principal-1', 'form-1'];

function fan(overrides: Partial<Parameters<typeof dangerFanOut>[0]> = {}) {
  return dangerFanOut({
    type: 'bullying',
    who: '',
    concernRole: '',
    dontTellParents: false,
    links: parents,
    staffUids: staff,
    ...overrides,
  });
}

test('danger fan-out drops every parent link when parents are excluded', () => {
  for (const excluded of [
    fan({ type: 'abuse' }),
    fan({ concernRole: 'parent' }),
    fan({ concernRole: 'guardian' }),
    fan({ who: 'my dad shouted' }),
    fan({ who: 'the mother' }),
    fan({ dontTellParents: true }),
  ]) {
    assert.equal(excluded.excluded, true);
    assert.deepEqual(excluded.parentUids, []);
    assert.deepEqual(excluded.recipients, staff);
    for (const link of parents) {
      assert.equal(excluded.recipients.includes(link.parentId), false);
    }
  }
});

test('danger fan-out includes approved parents only when nothing excludes them', () => {
  const open = fan();
  assert.equal(open.excluded, false);
  assert.deepEqual(open.parentUids, ['parent-a', 'parent-b']);
  assert.deepEqual(open.recipients, ['parent-a', 'parent-b', ...staff]);
  assert.equal(parentsExcluded({ type: 'harassment', who: 'a classmate', concernRole: 'student', dontTellParents: false }), false);
});

test('tracker, rate, and under-13 notice stay narrow', () => {
  assert.equal(trackerFor('pending'), 'received');
  assert.equal(trackerFor('in_progress'), 'being_looked_at');
  assert.equal(trackerFor('kiv'), 'being_looked_at');
  assert.equal(trackerFor('solved'), 'action_taken');
  assert.equal(trackerFor('closed'), 'closed');
  assert.deepEqual(safetyRateFlag(2), { throttled: false, flagged: false });
  assert.deepEqual(safetyRateFlag(3), { throttled: true, flagged: true });
  assert.equal('blocked' in safetyRateFlag(9), false);
  assert.equal(needsUrgentLeadNotice('under13'), true);
  assert.equal(needsUrgentLeadNotice('teen'), false);
  assert.equal(needsUrgentLeadNotice(''), false);
  assert.equal(dangerRepeatFlag(1), false);
  assert.equal(dangerRepeatFlag(2), true);
});

test('reporter identity is limited to the lead, the principal, and the super admin', () => {
  const ticket = {
    source: 'student_safety_report',
    reporterUid: 'student-1',
    formTeacherUid: 'form-1',
    institutionId: 'school-1',
    parentsExcluded: false,
    notifiedParentUids: ['parent-a'],
  };
  assert.equal(canSeeReporter('admin', ''), true);
  assert.equal(canSeeReporter('teacher', 'principal'), true);
  assert.equal(canSeeReporter('teacher', 'safeguarding_lead'), true);
  assert.equal(canSeeReporter('teacher', 'teacher'), false);
  assert.equal(canSeeReporter('institution_admin', ''), false);
  assert.equal(safetyView({ id: 'admin-1', role: 'admin', staffPost: '' }, ticket), 'full');
  assert.equal(safetyView({ id: 'p', role: 'teacher', staffPost: 'principal', institutionId: 'school-1' }, ticket), 'full');
  assert.equal(safetyView({ id: 'l', role: 'teacher', staffPost: 'safeguarding_lead', institutionId: 'school-1' }, ticket), 'full');
  assert.equal(safetyView({ id: 'p', role: 'teacher', staffPost: 'principal', institutionId: 'school-2' }, ticket), 'hidden');
  assert.equal(safetyView({ id: 'student-1', role: 'student', staffPost: '' }, ticket), 'tracker');
  assert.equal(safetyView({ id: 'peer', role: 'student', staffPost: '', institutionId: 'school-1' }, ticket), 'hidden');
  assert.equal(safetyView({ id: 't', role: 'teacher', staffPost: 'teacher', institutionId: 'school-1' }, ticket), 'hidden');
  assert.equal(safetyView({ id: 'ia', role: 'institution_admin', staffPost: '', institutionId: 'school-1' }, ticket), 'hidden');
  assert.equal(safetyView({ id: 'form-1', role: 'teacher', staffPost: 'teacher', institutionId: 'school-1' }, ticket), 'hidden');
  const danger = { ...ticket, source: 'danger_now' };
  assert.equal(safetyView({ id: 'form-1', role: 'teacher', staffPost: 'teacher', institutionId: 'school-1' }, danger), 'notice');
  assert.equal(safetyView({ id: 'parent-a', role: 'parent', staffPost: '' }, danger), 'notice');
  assert.equal(safetyView({ id: 'parent-a', role: 'parent', staffPost: '' }, { ...danger, parentsExcluded: true }), 'hidden');
  assert.equal(safetyView({ id: 'parent-a', role: 'parent', staffPost: '' }, { ...danger, parentsExcluded: true, notifiedParentUids: ['parent-a'] }), 'hidden');
});

test('a place is typed once, and a missed staff ack escalates after five minutes', () => {
  assert.equal(placeOnce(false, 'the library', 10), null);
  assert.equal(placeOnce(true, '  ', 10), null);
  assert.deepEqual(placeOnce(true, ' the library ', 10), { place: 'the library', at: 10 });
  const created = 1_000;
  assert.equal(dangerNeedsEscalation(created, 0, 0, created + DANGER_ACK_MS), false);
  assert.equal(dangerNeedsEscalation(created, 0, 0, created + DANGER_ACK_MS + 1), true);
  assert.equal(dangerNeedsEscalation(created, 50, 0, created + DANGER_ACK_MS + 1), false);
  assert.equal(dangerNeedsEscalation(created, 0, 50, created + DANGER_ACK_MS + 1), false);
});

test('helplines fall back to Malaysia and reject a bad catalogue', () => {
  const lines = helplinesFor('Malaysia', []);
  assert.equal(lines.some(line => line.number === '15999'), true);
  assert.equal(lines.some(line => line.name === 'Befrienders KL' && line.number === '+603-7627 2929'), true);
  assert.equal(helplinesFor('my', []).length, lines.length);
  assert.equal(cleanHelplines([{ country: 'Singapore', name: 'SOS', number: '1767', note: '' }])?.[0]?.number, '1767');
  assert.equal(cleanHelplines([]), null);
  assert.equal(cleanHelplines([{ country: 'X', name: 'Y', number: '1', note: '' }]), null);
});
