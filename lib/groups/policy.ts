/**
 * Groups and associations. Students create inside their school, with a teacher.
 */

export type GroupKind = 'interest' | 'club' | 'study' | 'association' | 'alumni' | 'professional';

export type GroupVisibility = 'public' | 'private' | 'secret';

export type GroupRole = 'founder' | 'president' | 'officer' | 'moderator' | 'member' | 'advisor';

export type ApprovalMode = 'school' | 'auto';

export interface GroupDraft {
  kind: GroupKind;
  visibility: GroupVisibility;
  institutionId: string;
  advisorId: string;
  creatorAgeTier: 'under13' | 'teen' | 'adult';
  creatorInstitutionId: string;
}

export interface GroupGate {
  ok: boolean;
  reason: string;
  status: 'pending' | 'active';
  schoolOnly: boolean;
}

export function reviewGroupDraft(draft: GroupDraft, mode: ApprovalMode, studentGroupsOn: boolean): GroupGate {
  const minor = draft.creatorAgeTier !== 'adult';
  if (minor) {
    if (!studentGroupsOn) return { ok: false, reason: 'Student groups are turned off.', status: 'pending', schoolOnly: true };
    if (!draft.creatorInstitutionId || draft.institutionId !== draft.creatorInstitutionId) {
      return { ok: false, reason: 'Students start groups inside their own school.', status: 'pending', schoolOnly: true };
    }
    if (!draft.advisorId) {
      return { ok: false, reason: 'A teacher advisor is required.', status: 'pending', schoolOnly: true };
    }
    if (draft.visibility === 'public') {
      return { ok: false, reason: 'School groups are not public outside the institution.', status: 'pending', schoolOnly: true };
    }
    return {
      ok: true,
      reason: '',
      status: mode === 'auto' ? 'active' : 'pending',
      schoolOnly: true,
    };
  }
  return { ok: true, reason: '', status: 'active', schoolOnly: false };
}

export function canSeeGroup(input: {
  schoolOnly: boolean;
  visibility: GroupVisibility;
  invited: boolean;
  member: boolean;
  sameInstitution: boolean;
}): boolean {
  if (input.member || input.invited) return true;
  if (input.visibility === 'secret') return false;
  if (input.schoolOnly) return input.sameInstitution;
  return true;
}

/** Public groups can be joined. Private groups need a request. Secret groups need an invite. */
export function canJoinGroup(input: {
  schoolOnly: boolean;
  visibility: GroupVisibility;
  invited: boolean;
  sameInstitution: boolean;
  sameClass: boolean;
  staff: boolean;
  minor: boolean;
}): boolean {
  if (input.schoolOnly) {
    if (!input.sameInstitution) return false;
    if (input.minor && !input.sameClass && !input.staff) return false;
  }
  if (input.visibility === 'secret' || input.visibility === 'private') return input.invited;
  return true;
}

export function canGroupChat(input: { minor: boolean; schoolApproved: boolean; advisorPresent: boolean; adultGroup: boolean }): boolean {
  if (input.adultGroup && !input.minor) return true;
  return input.schoolApproved && input.advisorPresent && input.minor;
}

export type GroupBadge = 'founder' | 'officer' | 'active_member';

export function groupBadges(input: { role: GroupRole; posts: number }): GroupBadge[] {
  const badges: GroupBadge[] = [];
  if (input.role === 'founder') badges.push('founder');
  if (input.role === 'president' || input.role === 'officer' || input.role === 'founder') badges.push('officer');
  if (input.posts >= 4) badges.push('active_member');
  return badges;
}

export function groupXp(input: { posts: number; events: number; role: GroupRole }): number {
  const lead = input.role === 'founder' || input.role === 'president' || input.role === 'officer' ? 20 : 0;
  return input.posts * 5 + input.events * 10 + lead;
}

/** Verified on a CV only after the school or the advisor confirms it. */
export function leadershipRecord(input: { role: GroupRole; confirmed: boolean; groupName: string }): { title: string; verified: boolean } | null {
  if (input.role !== 'founder' && input.role !== 'president' && input.role !== 'officer') return null;
  const title = input.role === 'founder' ? 'Founder' : input.role === 'president' ? 'President' : 'Officer';
  return { title: `${title}, ${input.groupName}`, verified: input.confirmed };
}

export function suggestGroups<T extends { id: string; skills: string[]; institutionId: string; interests: string[] }>(
  viewer: { skills: string[]; institutionId: string; interests: string[] },
  groups: T[],
): T[] {
  const score = (group: T) => {
    let value = 0;
    if (viewer.institutionId && group.institutionId === viewer.institutionId) value += 3;
    value += group.skills.filter(skill => viewer.skills.includes(skill)).length;
    value += group.interests.filter(interest => viewer.interests.includes(interest)).length;
    return value;
  };
  return [...groups].sort((a, b) => score(b) - score(a));
}
