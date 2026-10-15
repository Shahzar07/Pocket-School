import { describe, it } from 'node:test';
import { expect } from '../test-expect';
import {
  canDirectMessage, canExplore, canFollow, canReadChannel, canSeeSpace, visibleToViewer,
} from './policy';
import type { CommunityPerson, CommunitySpace } from './policy';

const child: CommunityPerson = { id: 'c1', role: 'student', ageTier: 'under13' };
const child2: CommunityPerson = { id: 'c2', role: 'student', ageTier: 'under13' };
const teen: CommunityPerson = {
  id: 'n1', role: 'student', ageTier: 'teen', yearGroup: 'Year 10', subjects: ['Maths'],
};
const teenOther: CommunityPerson = {
  id: 'n2', role: 'student', ageTier: 'teen', yearGroup: 'Year 11', subjects: ['English'],
};
const adult: CommunityPerson = { id: 'a1', role: 'student', ageTier: 'adult', adultDmOptIn: true };
const adultPal: CommunityPerson = { id: 'a3', role: 'student', ageTier: 'adult', adultDmOptIn: true };
const adultShy: CommunityPerson = { id: 'a2', role: 'student', ageTier: 'adult', adultDmOptIn: false };
const teacher: CommunityPerson = { id: 't1', role: 'teacher', ageTier: 'adult' };
const otherTeacher: CommunityPerson = { id: 't2', role: 'teacher', ageTier: 'adult' };
const parent: CommunityPerson = { id: 'p1', role: 'parent', ageTier: 'adult' };

const school: CommunitySpace = {
  id: 's-school', kind: 'school', ageTier: 'under13', visibility: 'members',
  memberIds: ['c1'], staffIds: [],
};
const year: CommunitySpace = {
  id: 's-year', kind: 'year', ageTier: 'teen', visibility: 'tier',
  memberIds: [], staffIds: [], year: 'Year 10',
};
const subject: CommunitySpace = {
  id: 's-subject', kind: 'subject', ageTier: 'teen', visibility: 'tier',
  memberIds: [], staffIds: [], subject: 'Maths',
};
const adultSpace: CommunitySpace = {
  id: 's-adult', kind: 'adult', ageTier: 'adult', visibility: 'tier', memberIds: [], staffIds: [],
};
const classSpace: CommunitySpace = {
  id: 's-class', kind: 'class', ageTier: 'under13', visibility: 'members',
  memberIds: ['c1'], staffIds: ['t1'],
};

describe('spaces', () => {
  it('keeps the three bands apart and lets class staff through', () => {
    expect(canSeeSpace(child, school).ok).toBe(true);
    expect(canSeeSpace(child2, school).reason).toBe('not_a_member');
    expect(canSeeSpace(child, subject).reason).toBe('cross_tier');
    expect(canSeeSpace(child, year).reason).toBe('cross_tier');
    expect(canSeeSpace(child, { ...subject, ageTier: 'under13' }).reason).toBe('explore_closed');
    expect(canSeeSpace(teen, year).ok).toBe(true);
    expect(canSeeSpace(teen, subject).ok).toBe(true);
    expect(canSeeSpace(teenOther, year).reason).toBe('explore_closed');
    expect(canSeeSpace(teenOther, subject).reason).toBe('explore_closed');
    expect(canSeeSpace(adult, adultSpace).ok).toBe(true);
    expect(canSeeSpace(adult, classSpace).reason).toBe('cross_tier');
    expect(canSeeSpace(teen, adultSpace).reason).toBe('cross_tier');
    expect(canSeeSpace(child, adultSpace).reason).toBe('cross_tier');
    expect(canSeeSpace(parent, classSpace).reason).toBe('parent_wall');
    expect(canSeeSpace(parent, adultSpace).reason).toBe('parent_wall');
    expect(canSeeSpace(teacher, classSpace).ok).toBe(true);
    expect(canSeeSpace(otherTeacher, classSpace).reason).toBe('cross_tier');
    expect(canSeeSpace(child, classSpace).ok).toBe(true);
  });
});

describe('follows, search, explore', () => {
  it('blocks every cross-tier social action and the parent wall', () => {
    expect(canFollow(child, teen).reason).toBe('cross_tier');
    expect(canFollow(adult, child).reason).toBe('cross_tier');
    expect(canFollow(teen, teenOther).ok).toBe(true);
    expect(canFollow(parent, adult).reason).toBe('parent_wall');
    expect(canExplore(adult).ok).toBe(true);
    expect(canExplore(teen).ok).toBe(true);
    expect(canExplore(child).reason).toBe('explore_closed');
    expect(canExplore(parent).reason).toBe('explore_closed');
    const hits = visibleToViewer(adult, [
      { ageTier: 'adult' as const, id: 'a' },
      { ageTier: 'teen' as const, id: 'n' },
      { ageTier: 'under13' as const, id: 'c' },
    ]);
    expect(hits.map((h) => h.id)).toEqual(['a']);
    expect(visibleToViewer(parent, [{ ageTier: 'adult' as const, id: 'a' }])).toEqual([]);
  });
});

describe('direct messages', () => {
  it('allows adult DMs only', () => {
    expect(canDirectMessage(child, child2).reason).toBe('minor_dm');
    expect(canDirectMessage(teen, teenOther).reason).toBe('minor_dm');
    expect(canDirectMessage(adult, child).reason).toBe('cross_tier');
    expect(canDirectMessage(teen, adult).reason).toBe('cross_tier');
    expect(canDirectMessage(teacher, child).reason).toBe('cross_tier');
    expect(canDirectMessage(parent, child).reason).toBe('cross_tier');
    expect(canDirectMessage(adult, adultPal).ok).toBe(true);
    expect(canDirectMessage(adult, adultShy).reason).toBe('adult_dm_opt_in');
    expect(canDirectMessage(parent, teacher).ok).toBe(true);
  });
});

describe('channels', () => {
  it('lets staff read their class channel and nobody else cross the tier', () => {
    const channel = { kind: 'class' as const, ageTier: 'under13' as const, memberIds: ['c1'], staffIds: ['t1'] };
    expect(canReadChannel(teacher, channel).ok).toBe(true);
    expect(canReadChannel(otherTeacher, channel).reason).toBe('cross_tier');
    expect(canReadChannel(adult, channel).reason).toBe('cross_tier');
    expect(canReadChannel(child, channel).ok).toBe(true);
    const parents = { kind: 'parent' as const, ageTier: 'adult' as const, memberIds: ['p1', 't1'], staffIds: ['t1'] };
    expect(canReadChannel(parent, parents).ok).toBe(true);
    expect(canReadChannel(child, parents).reason).toBe('cross_tier');
  });
});
