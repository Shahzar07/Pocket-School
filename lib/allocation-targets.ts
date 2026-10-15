/**
 * One allocation list for every product.
 * A target is a role (`students`, `marketplace`, …) or a specific person,
 * class, parent, or institution (`user:…`, `class:…`, `parent:…`, `institution:…`).
 * Access is granted when any target matches. Older single-value fields are
 * expanded into this list when it is still empty.
 */

import { normalisePolicy, type AccessPolicy, type PolicyAudience } from './access-policy';

export const ROLE_TARGETS = ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'] as const;
export type RoleTarget = (typeof ROLE_TARGETS)[number];

const ROLE_SET = new Set<string>(ROLE_TARGETS);
const SPECIFIC = /^(user|class|parent|institution):[^\s,]{1,128}$/;

export interface TargetViewer {
  role: string;
  userId?: string | null;
  institutionId?: string | null;
  cohortIds?: readonly string[] | null;
}

export interface TargetMatch {
  hit: boolean;
  reason?: string;
}

export interface AllocationSource {
  targets?: readonly string[] | null;
  audiences?: readonly string[] | null;
  allocatedInstitutionIds?: readonly string[] | null;
  publishScope?: string | null;
  accessPolicy?: AccessPolicy | null;
  allocateLibrary?: boolean | null;
  allocateMarketplace?: boolean | null;
}

export function isAllocationTarget(value: string): boolean {
  return ROLE_SET.has(value) || SPECIFIC.test(value);
}

export function uniqueTokens(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

/** Stable order: roles first, then specific people, classes, and schools. */
export function normaliseTargets(values: readonly string[]): string[] {
  const roles: RoleTarget[] = [];
  const specific: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!isAllocationTarget(value) || seen.has(value)) continue;
    seen.add(value);
    if (ROLE_SET.has(value)) roles.push(value as RoleTarget);
    else specific.push(value);
  }
  roles.sort((a, b) => ROLE_TARGETS.indexOf(a) - ROLE_TARGETS.indexOf(b));
  specific.sort();
  return [...roles, ...specific];
}

function pushId(bucket: string[], prefix: string, id: string | null | undefined) {
  const clean = id?.trim();
  if (clean) bucket.push(`${prefix}:${clean}`);
}

/** Turn a saved policy into the shared target list. */
export function targetsFromPolicy(policy: AccessPolicy | null | undefined): string[] {
  if (!policy) return [];
  const targets: string[] = [];
  for (const item of policy.include ?? []) {
    if (item === 'users') {
      for (const id of policy.userIds ?? []) pushId(targets, 'user', id);
    } else if (item === 'cohorts') {
      for (const id of policy.cohortIds ?? []) pushId(targets, 'class', id);
    } else if (ROLE_SET.has(item)) {
      targets.push(item);
    }
  }
  if ((policy.include ?? []).includes('institutions')) {
    for (const id of policy.institutionIds ?? []) pushId(targets, 'institution', id);
  }
  for (const id of policy.userIds ?? []) {
    if ((policy.include ?? []).includes('parents') && !(policy.include ?? []).includes('users')) {
      pushId(targets, 'parent', id);
    }
  }
  return normaliseTargets(targets);
}

/**
 * Expand a document that still stores one scope, one audience, or the book
 * library/marketplace switches. An existing target list is left as it is.
 */
export function migrateAllocation(source: AllocationSource): string[] {
  const explicit = normaliseTargets(source.targets ?? []);
  if (explicit.length) return explicit;

  const policy = source.accessPolicy;
  if (policy && ((policy.include?.length ?? 0) > 0 || (policy.exclude?.length ?? 0) > 0)) {
    const fromPolicy = targetsFromPolicy(policy);
    if (fromPolicy.length) return fromPolicy;
  }

  const audiences = (source.audiences ?? []).filter(item => ROLE_SET.has(item));
  if (audiences.length) {
    const targets = [...audiences];
    if (audiences.includes('institutions')) {
      for (const id of source.allocatedInstitutionIds ?? []) pushId(targets, 'institution', id);
    }
    return normaliseTargets(targets);
  }

  if (source.publishScope === 'public') return ['all', 'marketplace'];
  if (source.publishScope === 'marketplace') return ['marketplace'];
  if (source.publishScope === 'institution') {
    const targets = ['institutions'];
    for (const id of source.allocatedInstitutionIds ?? []) pushId(targets, 'institution', id);
    return normaliseTargets(targets);
  }

  if (source.allocateLibrary != null || source.allocateMarketplace != null) {
    const targets = ['students', 'parents'];
    if (source.allocateLibrary) targets.push('institutions');
    if (source.allocateMarketplace) targets.push('marketplace');
    return normaliseTargets(targets);
  }

  return [];
}

export function classIdsOf(targets: readonly string[]): string[] {
  return normaliseTargets(targets)
    .filter(target => target.startsWith('class:'))
    .map(target => target.slice('class:'.length));
}

export function institutionIdsOf(targets: readonly string[]): string[] {
  return normaliseTargets(targets)
    .filter(target => target.startsWith('institution:'))
    .map(target => target.slice('institution:'.length));
}

/** Policy fields the access checks and Firestore rules already understand. */
export function targetsToPolicy(targets: readonly string[], base: AccessPolicy = { include: [], exclude: [] }): AccessPolicy {
  const clean = normaliseTargets(targets);
  const include = new Set<PolicyAudience>();
  const userIds: string[] = [];
  const cohortIds: string[] = [];
  const institutionIds: string[] = [];
  for (const target of clean) {
    if (target === 'students' || target === 'teachers' || target === 'parents' || target === 'all' || target === 'marketplace') {
      include.add(target);
    } else if (target === 'institutions') {
      include.add('institutions');
    } else if (target.startsWith('user:')) {
      include.add('users');
      userIds.push(target.slice('user:'.length));
    } else if (target.startsWith('parent:')) {
      include.add('users');
      userIds.push(target.slice('parent:'.length));
    } else if (target.startsWith('class:')) {
      include.add('cohorts');
      cohortIds.push(target.slice('class:'.length));
    } else if (target.startsWith('institution:')) {
      include.add('institutions');
      institutionIds.push(target.slice('institution:'.length));
    }
  }
  const next: AccessPolicy = {
    ...base,
    include: [...include],
    userIds,
    cohortIds,
    institutionIds,
  };
  if (include.has('institutions')) {
    next.institutionMode = institutionIds.length === 0 && clean.includes('institutions') ? 'all' : 'specific';
  }
  return normalisePolicy(next);
}

export function audiencesFromTargets(targets: readonly string[]): RoleTarget[] {
  return normaliseTargets(targets).filter((target): target is RoleTarget => ROLE_SET.has(target));
}

export type LegacyScope = 'institution' | 'public' | 'marketplace';

/** A single scope kept for older screens. The target list remains the source of truth. */
export function legacyScope(targets: readonly string[]): LegacyScope {
  const clean = normaliseTargets(targets);
  if (clean.includes('marketplace')) return 'marketplace';
  if (clean.includes('all')) return 'public';
  return 'institution';
}

export interface AllocationFields {
  targets: string[];
  classIds: string[];
  audiences: RoleTarget[];
  allocatedInstitutionIds: string[];
  accessPolicy: AccessPolicy;
  publishScope: LegacyScope;
}

export function allocationFields(targets: readonly string[], base: AccessPolicy = { include: [], exclude: [] }): AllocationFields {
  const clean = normaliseTargets(targets);
  const accessPolicy = targetsToPolicy(clean, base);
  return {
    targets: clean,
    classIds: classIdsOf(clean),
    audiences: audiencesFromTargets(clean),
    allocatedInstitutionIds: accessPolicy.institutionIds ?? [],
    accessPolicy,
    publishScope: legacyScope(clean),
  };
}

/** Keep the book booleans in step with the target list so older readers still work. */
export function bookFlagsFromTargets(targets: readonly string[]): { allocateLibrary: boolean; allocateMarketplace: boolean } {
  const clean = normaliseTargets(targets);
  return {
    allocateMarketplace: clean.includes('marketplace'),
    allocateLibrary: clean.some(target => target !== 'marketplace'),
  };
}

function oneMatch(target: string, viewer: TargetViewer, schools: readonly string[]): boolean {
  if (target === 'marketplace') return true;
  if (viewer.role === 'guest') return false;
  if (target === 'all') return true;
  if (target === 'students') return viewer.role === 'student';
  if (target === 'teachers') return viewer.role === 'teacher';
  if (target === 'parents') return viewer.role === 'parent';
  if (target === 'institutions') {
    if (!viewer.institutionId) return false;
    return schools.length === 0 || schools.includes(viewer.institutionId);
  }
  if (target.startsWith('institution:')) return viewer.institutionId === target.slice('institution:'.length);
  if (target.startsWith('user:') || target.startsWith('parent:')) {
    const id = target.slice(target.indexOf(':') + 1);
    return !!viewer.userId && viewer.userId === id;
  }
  if (target.startsWith('class:')) return (viewer.cohortIds ?? []).includes(target.slice('class:'.length));
  return false;
}

/** True when any selected target fits this viewer. */
export function anyTargetMatch(targets: readonly string[], viewer: TargetViewer): TargetMatch {
  const clean = normaliseTargets(targets);
  if (!clean.length) return { hit: false, reason: 'Not allocated to this audience' };
  const schools = institutionIdsOf(clean);
  const onlyBareInstitutions = clean.length === 1 && clean[0] === 'institutions' && schools.length === 0;
  if (onlyBareInstitutions && !viewer.institutionId) {
    return { hit: false, reason: 'No institution selected' };
  }
  for (const target of clean) {
    if (oneMatch(target, viewer, schools)) return { hit: true };
  }
  if (clean.includes('institutions') && schools.length === 0 && clean.every(target => target === 'institutions')) {
    return { hit: false, reason: 'No institution selected' };
  }
  return { hit: false, reason: 'Not allocated to this audience' };
}

export function targetLabel(token: string, labels: Record<string, string> = {}): string {
  return labels[token] ?? labelFor(token);
}

function labelFor(token: string): string {
  if (token === 'students') return 'students';
  if (token === 'teachers') return 'teachers';
  if (token === 'parents') return 'parents';
  if (token === 'institutions') return 'every institution';
  if (token === 'all') return 'everyone signed in';
  if (token === 'marketplace') return 'the marketplace';
  if (token.startsWith('user:')) return token.slice('user:'.length);
  if (token.startsWith('class:')) return token.slice('class:'.length);
  if (token.startsWith('parent:')) return token.slice('parent:'.length);
  if (token.startsWith('institution:')) return token.slice('institution:'.length);
  if (token.startsWith('programme:')) return token.slice('programme:'.length);
  return token;
}

/** A plain sentence, for example "Visible to students, Year 8, and the marketplace." */
export function describeTargets(targets: readonly string[], labels: Record<string, string> = {}): string {
  const clean = uniqueTokens(targets).filter(token => isAllocationTarget(token) || token.startsWith('programme:'));
  if (!clean.length) return 'Nobody is selected yet.';
  const names = clean.map(token => targetLabel(token, labels));
  if (names.length === 1) return `Visible to ${names[0]}.`;
  if (names.length === 2) return `Visible to ${names[0]} and ${names[1]}.`;
  const last = names[names.length - 1];
  return `Visible to ${names.slice(0, -1).join(', ')}, and ${last}.`;
}

/** Announcements and calendar rows: the target list, or the old single audience. */
export function recordVisible(
  record: { targets?: readonly string[] | null; audience?: string | null },
  viewer: TargetViewer,
): boolean {
  const targets = record.targets?.length
    ? normaliseTargets(record.targets)
    : record.audience
      ? normaliseTargets([record.audience === 'everyone' ? 'all' : record.audience])
      : ['all'];
  return anyTargetMatch(targets.length ? targets : ['all'], viewer).hit;
}
