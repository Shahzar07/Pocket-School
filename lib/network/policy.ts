/**
 * Professional network rules. Under-18 profiles stay inside the school.
 */

import { isMinorTier, type AgeTier } from '../age-tier';

export type NetworkRole = 'student' | 'parent' | 'teacher' | 'alumni' | 'learner' | 'staff' | 'admin';

export type ProfileVisibility = 'public' | 'network' | 'private' | 'school';

export type OpenToWork = 'no' | 'everyone' | 'recruiters';

export type Availability = 'open' | 'internship' | 'part_time' | 'closed';

export interface NetworkPerson {
  id: string;
  ageTier: AgeTier;
  role: string;
  institutionId: string;
  classIds: string[];
  handle: string;
  visibility: ProfileVisibility;
  openToWork: OpenToWork;
  shareContact: boolean;
  searchable: boolean;
  blockedIds: string[];
}

export interface FeedCandidate {
  id: string;
  authorId: string;
  orgId: string;
  institutionId: string;
  classId: string;
  skillIds: string[];
  createdAtMs: number;
}

export interface FeedContext {
  viewerId: string;
  connectionIds: string[];
  followedOrgIds: string[];
  institutionId: string;
  classIds: string[];
  skillIds: string[];
}

export function forcedVisibility(ageTier: AgeTier, requested: ProfileVisibility): ProfileVisibility {
  if (isMinorTier(ageTier)) return 'school';
  if (requested === 'school') return 'network';
  return requested;
}

export function canSearchProfile(viewer: NetworkPerson, profile: NetworkPerson): boolean {
  if (viewer.id === profile.id) return true;
  if (viewer.blockedIds.includes(profile.id) || profile.blockedIds.includes(viewer.id)) return false;
  if (isMinorTier(profile.ageTier)) {
    return viewer.institutionId !== '' && viewer.institutionId === profile.institutionId && !isMinorTier(viewer.ageTier)
      ? viewer.role === 'teacher' || viewer.role === 'admin' || viewer.role === 'staff'
      : viewer.institutionId !== '' && viewer.institutionId === profile.institutionId && sharesClass(viewer, profile);
  }
  if (isMinorTier(viewer.ageTier)) return false;
  if (!profile.searchable || profile.visibility === 'private') return false;
  if (profile.visibility === 'public' || profile.visibility === 'network') return true;
  return false;
}

function sharesClass(a: NetworkPerson, b: NetworkPerson): boolean {
  return a.classIds.some(id => b.classIds.includes(id));
}

export function canConnect(from: NetworkPerson, to: NetworkPerson): { ok: boolean; reason: string } {
  if (from.id === to.id) return { ok: false, reason: 'That is you.' };
  if (from.blockedIds.includes(to.id) || to.blockedIds.includes(from.id)) return { ok: false, reason: 'Not available.' };
  if (!isMinorTier(from.ageTier) && !isMinorTier(to.ageTier)) return { ok: true, reason: '' };
  if (isMinorTier(from.ageTier) !== isMinorTier(to.ageTier)) {
    const staff = from.role === 'teacher' || to.role === 'teacher' || from.role === 'staff' || to.role === 'staff';
    const sameSchool = from.institutionId !== '' && from.institutionId === to.institutionId;
    if (staff && sameSchool) return { ok: true, reason: '' };
    return { ok: false, reason: 'Under-18 members stay inside their school.' };
  }
  const sameSchool = from.institutionId !== '' && from.institutionId === to.institutionId;
  if (!sameSchool || !sharesClass(from, to)) {
    return { ok: false, reason: 'Students connect with classmates and teachers in their school.' };
  }
  return { ok: true, reason: '' };
}

export function canDirectMessage(a: NetworkPerson, b: NetworkPerson, connected: boolean): { ok: boolean; reason: string } {
  if (isMinorTier(a.ageTier) || isMinorTier(b.ageTier)) {
    return { ok: false, reason: 'Direct messages stay between adults who are connected.' };
  }
  if (!connected) return { ok: false, reason: 'Connect first, or accept a message request.' };
  if (a.blockedIds.includes(b.id) || b.blockedIds.includes(a.id)) return { ok: false, reason: 'Not available.' };
  return { ok: true, reason: '' };
}

export interface RecruiterQuery {
  skills: string[];
  level: string;
  certificates: string[];
  location: string;
  availability: Availability | '';
  institutionId: string;
}

export interface CandidateCard {
  id: string;
  ageTier: AgeTier;
  optedIn: boolean;
  openToWork: OpenToWork;
  availability: Availability;
  level: string;
  skills: { name: string; verified: boolean }[];
  certificates: string[];
  location: string;
  institutionId: string;
  email: string;
  phone: string;
  shareContact: boolean;
}

export function recruiterCanSee(candidate: CandidateCard): boolean {
  return candidate.ageTier === 'adult' && candidate.optedIn && candidate.openToWork !== 'no';
}

export function matchesRecruiter(candidate: CandidateCard, query: RecruiterQuery): boolean {
  if (!recruiterCanSee(candidate)) return false;
  if (query.availability && candidate.availability !== query.availability && candidate.openToWork === 'everyone') {
    if (candidate.availability !== query.availability) return false;
  }
  if (query.availability && candidate.availability !== query.availability) return false;
  if (query.level && candidate.level !== query.level) return false;
  if (query.location && candidate.location !== query.location) return false;
  if (query.institutionId && candidate.institutionId !== query.institutionId) return false;
  if (query.skills.length && !query.skills.every(skill => candidate.skills.some(item => item.verified && item.name === skill))) {
    return false;
  }
  if (query.certificates.length && !query.certificates.every(name => candidate.certificates.includes(name))) return false;
  return true;
}

/** Recruiters never receive contact details unless the candidate shares them. */
export function publicCandidate(candidate: CandidateCard): Omit<CandidateCard, 'email' | 'phone'> & { email: string; phone: string } {
  return {
    ...candidate,
    email: candidate.shareContact ? candidate.email : '',
    phone: candidate.shareContact ? candidate.phone : '',
  };
}

export function rankFeed(items: FeedCandidate[], context: FeedContext): FeedCandidate[] {
  const score = (item: FeedCandidate) => {
    let value = 0;
    if (context.connectionIds.includes(item.authorId)) value += 50;
    if (item.orgId && context.followedOrgIds.includes(item.orgId)) value += 30;
    if (item.institutionId && item.institutionId === context.institutionId) value += 20;
    if (item.classId && context.classIds.includes(item.classId)) value += 20;
    if (item.skillIds.some(skill => context.skillIds.includes(skill))) value += 10;
    value += Math.max(0, 5 - Math.floor((Date.now() - item.createdAtMs) / (7 * 24 * 60 * 60 * 1000)));
    return value;
  };
  return [...items].sort((a, b) => score(b) - score(a) || b.createdAtMs - a.createdAtMs);
}

/** Insights hide any group smaller than five. */
export function hideSmallGroups<T extends { n: number }>(rows: T[], floor = 5): T[] {
  return rows.filter(row => row.n >= floor);
}

export function shortlistSummary(candidates: { name: string; level: string; skills: string[]; certificates: string[] }[]): string {
  if (!candidates.length) return 'ET AI found no opted-in adults who match this search.';
  const lines = candidates.slice(0, 8).map(person => {
    const skills = person.skills.length ? person.skills.join(', ') : 'no verified skills on file';
    const certificates = person.certificates.length ? person.certificates.join(', ') : 'no certificates on file';
    return `${person.name}, ${person.level || 'level not set'}: ${skills}. Certificates: ${certificates}.`;
  });
  return `ET AI shortlist, verified fields only. ${lines.join(' ')}`;
}

export const CONSENT = {
  pdpa: 'Poket School processes this profile under the Malaysian PDPA. You can export or delete your network content.',
  gdpr: 'If you are in the GDPR region, you can export your network data and ask for it to be deleted.',
  child: 'Under-18 profiles stay inside the school. They are not public and they are not searchable.',
  investment: 'Poket School does not vet investments. Unsolicited fundraising pitches are blocked.',
  training: 'Flagged content is not used to train AI models.',
} as const;

export function validHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,30}$/.test(handle);
}
