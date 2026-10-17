/**
 * Poket School Founders. Adult opt-in matching. Under-18s stay in a school club.
 * No outside accelerator branding.
 */

export type FounderRole = 'technical' | 'business' | 'design' | 'domain';
export type Commitment = 'full_time' | 'part_time' | 'exploring';
export type StartupStage = 'idea' | 'building' | 'launched' | 'growing';

export interface FounderCard {
  id: string;
  ageTier: 'under13' | 'teen' | 'adult';
  optIn: boolean;
  hasIdea: boolean;
  roles: FounderRole[];
  commitment: Commitment;
  location: string;
  remote: boolean;
  timezone: string;
  industries: string[];
  skills: { name: string; verified: boolean }[];
  lookingFor: FounderRole[];
  stage: StartupStage;
  institutionId: string;
  classIds: string[];
}

export interface MatchSuggestion {
  id: string;
  score: number;
  reasons: string[];
}

const COMPLEMENT: Record<FounderRole, FounderRole[]> = {
  technical: ['business', 'design', 'domain'],
  business: ['technical', 'design', 'domain'],
  design: ['technical', 'business'],
  domain: ['technical', 'business'],
};

export function canJoinPublicMatching(person: FounderCard): boolean {
  return person.ageTier === 'adult' && person.optIn;
}

export function scorePair(a: FounderCard, b: FounderCard): MatchSuggestion | null {
  if (!canJoinPublicMatching(a) || !canJoinPublicMatching(b) || a.id === b.id) return null;
  let score = 0;
  const reasons: string[] = [];
  const complement = a.lookingFor.some(role => b.roles.includes(role))
    || b.lookingFor.some(role => a.roles.includes(role))
    || a.roles.some(role => b.roles.some(other => COMPLEMENT[role].includes(other)));
  if (complement) {
    score += 40;
    reasons.push('Complementary skills');
  }
  const shared = a.industries.filter(industry => b.industries.includes(industry));
  if (shared.length) {
    score += 20;
    reasons.push('Shared industries');
  }
  if (a.commitment === b.commitment) {
    score += 15;
    reasons.push('Same commitment');
  }
  if (a.location && a.location === b.location) {
    score += 10;
    reasons.push('Same location');
  } else if (a.remote && b.remote) {
    score += 8;
    reasons.push('Both open to remote');
  }
  if (a.timezone && a.timezone === b.timezone) {
    score += 7;
    reasons.push('Same timezone');
  }
  if (score < 25) return null;
  return { id: b.id, score, reasons };
}

export function suggestPartners(viewer: FounderCard, pool: FounderCard[]): MatchSuggestion[] {
  if (!canJoinPublicMatching(viewer)) return [];
  return pool
    .map(person => scorePair(viewer, person))
    .filter((hit): hit is MatchSuggestion => hit != null)
    .sort((a, b) => b.score - a.score);
}

export function mutualInterest(aToB: 'skip' | 'interested' | '', bToA: 'skip' | 'interested' | ''): boolean {
  return aToB === 'interested' && bToA === 'interested';
}

export function studentCanTeam(a: FounderCard, b: FounderCard): boolean {
  if (a.ageTier === 'adult' || b.ageTier === 'adult') return false;
  if (!a.institutionId || a.institutionId !== b.institutionId) return false;
  return a.classIds.some(id => b.classIds.includes(id));
}
