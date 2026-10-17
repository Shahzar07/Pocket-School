import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canConnect, canDirectMessage, canSearchProfile, forcedVisibility, hideSmallGroups,
  matchesRecruiter, publicCandidate, rankFeed, recruiterCanSee, shortlistSummary, validHandle,
  type CandidateCard, type NetworkPerson,
} from './policy';
import { readAutomation } from './settings';

function person(patch: Partial<NetworkPerson>): NetworkPerson {
  return {
    id: 'a',
    ageTier: 'adult',
    role: 'learner',
    institutionId: '',
    classIds: [],
    handle: 'amina',
    visibility: 'public',
    openToWork: 'no',
    shareContact: false,
    searchable: true,
    blockedIds: [],
    ...patch,
  };
}

test('under-18 profiles are school-only and adults keep the visibility they chose', () => {
  assert.equal(forcedVisibility('teen', 'public'), 'school');
  assert.equal(forcedVisibility('under13', 'network'), 'school');
  assert.equal(forcedVisibility('adult', 'public'), 'public');
  assert.equal(validHandle('amina-yusuf'), true);
  assert.equal(validHandle('A'), false);
});

test('students connect inside class and do not message outside adults', () => {
  const student = person({ id: 's', ageTier: 'teen', role: 'student', institutionId: 'north', classIds: ['c1'] });
  const mate = person({ id: 'm', ageTier: 'teen', role: 'student', institutionId: 'north', classIds: ['c1'] });
  const other = person({ id: 'o', ageTier: 'teen', role: 'student', institutionId: 'north', classIds: ['c2'] });
  const teacher = person({ id: 't', ageTier: 'adult', role: 'teacher', institutionId: 'north' });
  const stranger = person({ id: 'x', ageTier: 'adult', role: 'learner' });
  assert.equal(canConnect(student, mate).ok, true);
  assert.equal(canConnect(student, other).ok, false);
  assert.equal(canConnect(student, teacher).ok, true);
  assert.equal(canConnect(student, stranger).ok, false);
  assert.equal(canDirectMessage(student, teacher, true).ok, false);
  assert.equal(canDirectMessage(stranger, teacher, false).ok, false);
  assert.equal(canDirectMessage(stranger, teacher, true).ok, true);
  assert.equal(canSearchProfile(stranger, student), false);
  assert.equal(canSearchProfile(mate, student), true);
});

test('recruiter search keeps contact details private and skips anyone who did not opt in', () => {
  const candidate: CandidateCard = {
    id: 'ada',
    ageTier: 'adult',
    optedIn: true,
    openToWork: 'recruiters',
    availability: 'internship',
    level: 'A-Level',
    skills: [{ name: 'Python', verified: true }],
    certificates: ['IGCSE Mathematics'],
    location: 'Kuala Lumpur',
    institutionId: 'north',
    email: 'ada@example.com',
    phone: '0123456789',
    shareContact: false,
  };
  assert.equal(recruiterCanSee({ ...candidate, ageTier: 'teen' }), false);
  assert.equal(recruiterCanSee({ ...candidate, optedIn: false }), false);
  assert.equal(matchesRecruiter(candidate, {
    skills: ['Python'], level: 'A-Level', certificates: [], location: 'Kuala Lumpur', availability: 'internship', institutionId: 'north',
  }), true);
  assert.equal(publicCandidate(candidate).email, '');
  assert.equal(publicCandidate({ ...candidate, shareContact: true }).email, 'ada@example.com');
  assert.match(shortlistSummary([{ name: 'Ada', level: 'A-Level', skills: ['Python'], certificates: [] }]), /verified fields only/);
});

test('the feed prefers connections and insights hide groups under five', () => {
  const ranked = rankFeed([
    { id: '1', authorId: 'stranger', orgId: '', institutionId: '', classId: '', skillIds: [], createdAtMs: 50 },
    { id: '2', authorId: 'friend', orgId: '', institutionId: '', classId: '', skillIds: [], createdAtMs: 10 },
  ], {
    viewerId: 'me', connectionIds: ['friend'], followedOrgIds: [], institutionId: '', classIds: [], skillIds: [],
  });
  assert.equal(ranked[0]?.id, '2');
  assert.deepEqual(hideSmallGroups([{ id: 'a', n: 4 }, { id: 'b', n: 5 }]).map(row => row.id), ['b']);
});

test('founders and recruiter billing stay off until a super admin turns them on', () => {
  const settings = readAutomation({});
  assert.equal(settings.networkOn, true);
  assert.equal(settings.foundersOn, false);
  assert.equal(settings.recruiterTierOn, false);
  assert.equal(settings.studentGroupsOn, true);
  assert.equal(settings.groupApprovalMode, 'school');
  assert.equal(readAutomation({ foundersOn: true, recruiterProCents: 4900 }).recruiterProCents, 4900);
});
