/**
 * The only alert recipient list. Safety, danger, hotline, amber, emergency,
 * Safety Desk, and all-staff fan-out all go through resolveRecipients.
 */

import { escalationTarget, isAddressedTo, type AddressedTo } from '../hotline/policy';
import { regionMatch, type Region } from '../emergency/policy';
import { parentsExcluded } from '../safety/policy';

export const RECIPIENT_KINDS = [
  'student_safety_report',
  'danger_now',
  'hotline',
  'amber',
  'emergency',
  'safety_desk',
  'all_staff',
] as const;
export type RecipientKind = (typeof RECIPIENT_KINDS)[number];

export interface AlertPerson {
  uid: string;
  role: string;
  staffPost: string;
  institutionId: string;
  country: string;
  state: string;
  city: string;
  homeCountry: string;
  emergencyOptIn: boolean;
  verificationTier: number;
}

export interface ResolveInput {
  kind: RecipientKind;
  institutionId: string;
  people: readonly AlertPerson[];
  formTeacherUid?: string;
  parentUids?: readonly string[];
  parentsExcluded?: boolean;
  exclusion?: { type: string; who: string; concernRole: string; dontTellParents: boolean };
  addressedTo?: string;
  addressedUid?: string;
  sensitive?: boolean;
  region?: Region;
  primaryUid?: string;
  backupUid?: string;
  guardianUids?: readonly string[];
  guardianTiers?: Readonly<Record<string, number>>;
  escalate?: boolean;
}

export interface ResolvedRecipients {
  uids: string[];
  /** Confidential case card. Never a parent-only account. */
  staffUids: string[];
  /** Linked parents who were not excluded. */
  parentUids: string[];
  communityUids: string[];
  optedInUids: string[];
  parentsExcluded: boolean;
}

const COUNTRY_ALIASES: Record<string, string> = {
  my: 'my',
  malaysia: 'my',
  us: 'us',
  usa: 'us',
  'united states': 'us',
  'united states of america': 'us',
  gb: 'gb',
  uk: 'gb',
  'united kingdom': 'gb',
  'great britain': 'gb',
};

export function alertPerson(partial: Partial<AlertPerson> & { uid: string }): AlertPerson {
  return {
    uid: partial.uid,
    role: partial.role ?? '',
    staffPost: partial.staffPost ?? '',
    institutionId: partial.institutionId ?? '',
    country: partial.country ?? '',
    state: partial.state ?? '',
    city: partial.city ?? '',
    homeCountry: partial.homeCountry ?? '',
    emergencyOptIn: partial.emergencyOptIn === true,
    verificationTier: partial.verificationTier ?? 0,
  };
}

export function countryKey(value: string): string {
  const text = value.trim().toLowerCase();
  return COUNTRY_ALIASES[text] ?? text;
}

export function homeCountryMatches(homeCountry: string, regionCountry: string): boolean {
  if (!homeCountry.trim() || !regionCountry.trim()) return false;
  return countryKey(homeCountry) === countryKey(regionCountry);
}

/** Addressed post, then every post escalation can reach. */
export function hotlinePosts(addressedTo: string, sensitive: boolean): AddressedTo[] {
  const posts: AddressedTo[] = [];
  const seen = new Set<string>();
  const add = (post: string) => {
    if (!isAddressedTo(post) || seen.has(post)) return;
    seen.add(post);
    posts.push(post);
  };
  add(addressedTo);
  for (let level = 0; level < 4; level += 1) {
    const post = escalationTarget(level, sensitive);
    if (!post) break;
    add(post);
  }
  return posts;
}

function unique(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function atSchool(person: AlertPerson, institutionId: string): boolean {
  return Boolean(institutionId) && person.institutionId === institutionId && Boolean(person.uid);
}

function isSchoolStaff(person: AlertPerson): boolean {
  if (person.role === 'student' || person.role === 'parent') return false;
  if (person.role === 'teacher' || person.role === 'institution_admin') return true;
  return person.staffPost === 'teacher'
    || person.staffPost === 'academic_lead'
    || person.staffPost === 'principal'
    || person.staffPost === 'safeguarding_lead';
}

function exclusionOn(input: ResolveInput): boolean {
  if (input.parentsExcluded === true) return true;
  if (!input.exclusion) return false;
  return parentsExcluded(input.exclusion);
}

function safetyStaff(input: ResolveInput): string[] {
  const posts = input.people
    .filter(person => atSchool(person, input.institutionId))
    .filter(person => person.staffPost === 'safeguarding_lead' || person.staffPost === 'principal')
    .map(person => person.uid);
  return unique([...posts, input.formTeacherUid ?? '']);
}

function hotlineStaff(input: ResolveInput): string[] {
  const posts = new Set(hotlinePosts(input.addressedTo ?? '', input.sensitive === true));
  const holders = input.people
    .filter(person => atSchool(person, input.institutionId) && posts.has(person.staffPost as AddressedTo))
    .map(person => person.uid);
  return unique([...holders, input.addressedUid ?? '']);
}

function community(input: ResolveInput): { communityUids: string[]; optedInUids: string[] } {
  const communityUids = unique(
    input.people.filter(person => atSchool(person, input.institutionId)).map(person => person.uid),
  );
  const inside = new Set(communityUids);
  const region = input.region ?? { country: '', state: '', city: '' };
  const optedInUids = unique(
    input.people
      .filter(person => person.emergencyOptIn && person.uid && !inside.has(person.uid))
      .filter(person => regionMatch(
        { country: person.country, state: person.state, city: person.city },
        region,
      ) || homeCountryMatches(person.homeCountry, region.country))
      .map(person => person.uid),
  );
  return { communityUids, optedInUids };
}

function desk(input: ResolveInput): { staffUids: string[]; parentUids: string[] } {
  const excluded = new Set<string>();
  if (exclusionOn(input)) {
    for (const uid of input.parentUids ?? []) if (uid) excluded.add(uid);
  }
  const tierOf = (uid: string) => {
    if (input.guardianTiers && uid in input.guardianTiers) return input.guardianTiers[uid] ?? 0;
    return input.people.find(person => person.uid === uid)?.verificationTier ?? 0;
  };
  const guardians = (input.guardianUids ?? []).filter(uid => tierOf(uid) >= 2 && !excluded.has(uid));
  const supers = input.people.filter(person => person.role === 'admin' && person.uid && !excluded.has(person.uid)).map(person => person.uid);
  const staffUids = unique([
    ...supers,
    excluded.has(input.primaryUid ?? '') ? '' : (input.primaryUid ?? ''),
    input.escalate ? (excluded.has(input.backupUid ?? '') ? '' : (input.backupUid ?? '')) : '',
  ]);
  return { staffUids, parentUids: unique(guardians) };
}

function empty(excluded: boolean): ResolvedRecipients {
  return {
    uids: [],
    staffUids: [],
    parentUids: [],
    communityUids: [],
    optedInUids: [],
    parentsExcluded: excluded,
  };
}

/** One list. Callers must not add another staff or parent fan-out. */
export function resolveRecipients(input: ResolveInput): ResolvedRecipients {
  const excluded = exclusionOn(input);
  if (input.kind === 'student_safety_report' || input.kind === 'danger_now') {
    const staffUids = safetyStaff(input);
    const parentUids = excluded ? [] : unique(input.parentUids ?? []);
    return {
      uids: unique([...staffUids, ...parentUids]),
      staffUids,
      parentUids,
      communityUids: [],
      optedInUids: [],
      parentsExcluded: excluded,
    };
  }
  if (input.kind === 'hotline') {
    const staffUids = hotlineStaff(input);
    return { ...empty(false), uids: staffUids, staffUids };
  }
  if (input.kind === 'amber' || input.kind === 'emergency') {
    const groups = community(input);
    return {
      ...empty(false),
      uids: unique([...groups.communityUids, ...groups.optedInUids]),
      communityUids: groups.communityUids,
      optedInUids: groups.optedInUids,
    };
  }
  if (input.kind === 'safety_desk') {
    const groups = desk(input);
    return {
      ...empty(excluded),
      uids: unique([...groups.staffUids, ...groups.parentUids]),
      staffUids: groups.staffUids,
      parentUids: groups.parentUids,
      parentsExcluded: excluded,
    };
  }
  const staffUids = unique(
    input.people.filter(person => atSchool(person, input.institutionId) && isSchoolStaff(person)).map(person => person.uid),
  );
  return { ...empty(false), uids: staffUids, staffUids };
}
