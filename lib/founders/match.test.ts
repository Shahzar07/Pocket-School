import assert from 'node:assert/strict';
import test from 'node:test';
import { canJoinPublicMatching, mutualInterest, studentCanTeam, suggestPartners, type FounderCard } from './match';
import { canGroupChat, canJoinGroup, groupBadges, leadershipRecord, reviewGroupDraft } from '../groups/policy';

function founder(patch: Partial<FounderCard>): FounderCard {
  return {
    id: 'a',
    ageTier: 'adult',
    optIn: true,
    hasIdea: true,
    roles: ['technical'],
    commitment: 'full_time',
    location: 'Kuala Lumpur',
    remote: true,
    timezone: 'Asia/Kuala_Lumpur',
    industries: ['education'],
    skills: [{ name: 'Python', verified: true }],
    lookingFor: ['business'],
    stage: 'building',
    institutionId: 'north',
    classIds: ['c1'],
    ...patch,
  };
}

test('ET AI suggests a complementary adult and skips under-18 public matching', () => {
  const tech = founder({ id: 'tech' });
  const business = founder({ id: 'biz', roles: ['business'], lookingFor: ['technical'], commitment: 'full_time' });
  const teen = founder({ id: 'teen', ageTier: 'teen' });
  assert.equal(canJoinPublicMatching(teen), false);
  const hits = suggestPartners(tech, [business, teen, tech]);
  assert.equal(hits[0]?.id, 'biz');
  assert.equal(hits.some(hit => hit.id === 'teen'), false);
  assert.match(hits[0]?.reasons.join(' ') ?? '', /Complementary/);
  assert.equal(mutualInterest('interested', 'interested'), true);
  assert.equal(mutualInterest('interested', 'skip'), false);
});

test('student founders team up only with classmates', () => {
  const a = founder({ id: 'a', ageTier: 'teen', optIn: false });
  const b = founder({ id: 'b', ageTier: 'teen', optIn: false });
  const c = founder({ id: 'c', ageTier: 'teen', classIds: ['other'] });
  assert.equal(studentCanTeam(a, b), true);
  assert.equal(studentCanTeam(a, c), false);
  assert.equal(studentCanTeam(a, founder({ ageTier: 'adult' })), false);
});

test('a school club needs an advisor and an adult group can cross institutions', () => {
  const pending = reviewGroupDraft({
    kind: 'club',
    visibility: 'private',
    institutionId: 'north',
    advisorId: 'teacher',
    creatorAgeTier: 'teen',
    creatorInstitutionId: 'north',
  }, 'school', true);
  assert.equal(pending.status, 'pending');
  assert.equal(reviewGroupDraft({
    kind: 'club', visibility: 'private', institutionId: 'north', advisorId: '', creatorAgeTier: 'teen', creatorInstitutionId: 'north',
  }, 'auto', true).ok, false);
  const adult = reviewGroupDraft({
    kind: 'professional', visibility: 'public', institutionId: '', advisorId: '', creatorAgeTier: 'adult', creatorInstitutionId: '',
  }, 'school', true);
  assert.equal(adult.schoolOnly, false);
  assert.equal(adult.status, 'active');
  assert.equal(canJoinGroup({
    schoolOnly: true, visibility: 'private', invited: false, sameInstitution: true, sameClass: true, staff: false, minor: true,
  }), false);
  assert.equal(canGroupChat({ minor: true, schoolApproved: true, advisorPresent: true, adultGroup: false }), true);
  assert.equal(canGroupChat({ minor: true, schoolApproved: true, advisorPresent: false, adultGroup: false }), false);
  assert.deepEqual(groupBadges({ role: 'founder', posts: 4 }), ['founder', 'officer', 'active_member']);
  assert.equal(leadershipRecord({ role: 'president', confirmed: false, groupName: 'Robotics' })?.verified, false);
  assert.equal(leadershipRecord({ role: 'president', confirmed: true, groupName: 'Robotics' })?.verified, true);
});
