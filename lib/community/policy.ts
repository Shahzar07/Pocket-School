import type { AgeTier } from '../age-tier';
import { isMinorTier } from '../age-tier';
import type { Role } from '../roles';

/**
 * Who may see, follow, search, and message whom.
 * Mirrored by the helpers in firestore.rules. The mobile app reads the
 * collections directly, so a change here has to land in the rules too.
 */

export interface CommunityPerson {
  id: string;
  role: Role | string;
  ageTier: AgeTier;
  adultDmOptIn?: boolean;
  /** Server-set. Teens explore a year space only when this matches. */
  yearGroup?: string;
  /** Server-set. Teens explore a subject space only when this includes it. */
  subjects?: string[];
}

export interface CommunitySpace {
  id: string;
  kind: 'subject' | 'class' | 'school' | 'adult' | 'year';
  ageTier: AgeTier;
  visibility: 'tier' | 'members';
  memberIds: string[];
  staffIds: string[];
  year?: string;
  subject?: string;
}

export type PolicyReason =
  | 'ok'
  | 'cross_tier'
  | 'not_a_member'
  | 'minor_dm'
  | 'adult_dm_opt_in'
  | 'self'
  | 'explore_closed'
  | 'parent_wall';

export interface PolicyDecision {
  ok: boolean;
  reason: PolicyReason;
}

const ALLOW: PolicyDecision = { ok: true, reason: 'ok' };

function deny(reason: PolicyReason): PolicyDecision {
  return { ok: false, reason };
}

export function isStaffRole(role: string): boolean {
  return role === 'teacher' || role === 'admin' || role === 'institution_admin';
}

function onRoster(viewer: CommunityPerson, space: CommunitySpace): boolean {
  return space.memberIds.includes(viewer.id) || space.staffIds.includes(viewer.id);
}

export function canSeeSpace(viewer: CommunityPerson, space: CommunitySpace): PolicyDecision {
  const staffOnClass = space.kind === 'class'
    && space.staffIds.includes(viewer.id)
    && isStaffRole(viewer.role);
  if (staffOnClass) return ALLOW;
  if (viewer.role === 'parent') return deny('parent_wall');
  if (viewer.ageTier !== space.ageTier) return deny('cross_tier');

  if (viewer.ageTier === 'under13') {
    if (space.kind !== 'class' && space.kind !== 'school') return deny('explore_closed');
    return onRoster(viewer, space) ? ALLOW : deny('not_a_member');
  }

  if (viewer.ageTier === 'teen') {
    if ((space.kind === 'class' || space.kind === 'school') && onRoster(viewer, space)) return ALLOW;
    if (space.kind === 'year' && space.year && space.year === viewer.yearGroup) return ALLOW;
    if (space.kind === 'subject' && space.subject && (viewer.subjects ?? []).includes(space.subject)) return ALLOW;
    return deny('explore_closed');
  }

  if (space.visibility === 'tier' || onRoster(viewer, space)) return ALLOW;
  return deny('not_a_member');
}

export function canFollow(viewer: CommunityPerson, target: CommunityPerson): PolicyDecision {
  if (viewer.id === target.id) return deny('self');
  if (viewer.role === 'parent') return deny('parent_wall');
  if (viewer.ageTier !== target.ageTier) return deny('cross_tier');
  return ALLOW;
}

export function canSearch(viewer: CommunityPerson, hit: { ageTier: AgeTier }): boolean {
  if (viewer.role === 'parent') return false;
  return viewer.ageTier === hit.ageTier;
}

export function visibleToViewer<T extends { ageTier: AgeTier }>(viewer: CommunityPerson, hits: T[]): T[] {
  return hits.filter((hit) => canSearch(viewer, hit));
}

/**
 * Under-13 has no Explore. Teens explore only inside a matching year or subject.
 * Adults have open Explore. Parents never do.
 */
export function canExplore(viewer: CommunityPerson): PolicyDecision {
  if (viewer.role === 'parent' || viewer.ageTier === 'under13') return deny('explore_closed');
  return ALLOW;
}

/**
 * `messages` is adult-only. Minors use class channels, never direct messages.
 * Adult students need `adultDmOptIn` on both sides. Staff and parents do not.
 */
export function canDirectMessage(from: CommunityPerson, to: CommunityPerson): PolicyDecision {
  if (from.id === to.id) return deny('self');
  if (isMinorTier(from.ageTier) || isMinorTier(to.ageTier)) {
    return from.ageTier === to.ageTier ? deny('minor_dm') : deny('cross_tier');
  }
  if (from.ageTier !== 'adult' || to.ageTier !== 'adult') return deny('cross_tier');
  if (isStaffRole(from.role) || isStaffRole(to.role) || from.role === 'parent' || to.role === 'parent') {
    return ALLOW;
  }
  if (!from.adultDmOptIn || !to.adultDmOptIn) return deny('adult_dm_opt_in');
  return ALLOW;
}

export interface CommunityChannel {
  kind: 'class' | 'parent' | 'announcement' | 'dm';
  ageTier: AgeTier;
  memberIds: string[];
  staffIds: string[];
}

export function canReadChannel(viewer: CommunityPerson, channel: CommunityChannel): PolicyDecision {
  const staffOnClass = channel.kind === 'class'
    && channel.staffIds.includes(viewer.id)
    && isStaffRole(viewer.role);
  if (staffOnClass) return ALLOW;
  if (viewer.ageTier !== channel.ageTier) return deny('cross_tier');
  if (channel.memberIds.includes(viewer.id) || channel.staffIds.includes(viewer.id)) return ALLOW;
  return deny('not_a_member');
}

export function matchesQuery(text: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return false;
  return text.toLowerCase().includes(needle);
}
