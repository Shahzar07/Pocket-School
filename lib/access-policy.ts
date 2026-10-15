/**
 * Rich product access. A product with no policy keeps the audience list in
 * lib/allocation.ts. Once a policy is saved, include and exclude are combined
 * and the schedule, quota, and price gates below decide the rest.
 */

import type { AllocationViewer, AllocatableProduct } from './allocation';

export const POLICY_AUDIENCES = [
  'students', 'teachers', 'parents', 'institutions', 'users', 'cohorts', 'all', 'marketplace',
] as const;

export type PolicyAudience = (typeof POLICY_AUDIENCES)[number];

export const POLICY_AUDIENCE_LABELS: Record<PolicyAudience, string> = {
  students: 'Students',
  teachers: 'Teachers',
  parents: 'Parents',
  institutions: 'Institutions',
  users: 'Individual users',
  cohorts: 'Cohorts and classes',
  all: 'All signed-in people',
  marketplace: 'Marketplace',
};

export interface AccessPolicy {
  include: PolicyAudience[];
  exclude: PolicyAudience[];
  institutionMode?: 'specific' | 'all';
  institutionIds?: string[];
  excludeInstitutionIds?: string[];
  userIds?: string[];
  excludeUserIds?: string[];
  cohortIds?: string[];
  excludeCohortIds?: string[];
  programmeIds?: string[];
  yearGroups?: string[];
  levels?: string[];
  countries?: string[];
  regions?: string[];
  languages?: string[];
  /** YYYY-MM-DD. Empty means available now. */
  releaseOn?: string;
  expiresOn?: string;
  accessDays?: number;
  dripMode?: 'none' | 'lesson' | 'unit';
  dripEveryDays?: number;
  seatLimit?: number;
  seatsUsed?: number;
  sparksCost?: number;
  bundleIds?: string[];
  trialDays?: number;
  freePreviewCount?: number;
}

export interface AccessDecision {
  listed: boolean;
  open: boolean;
  reason: string;
}

export function isPolicyAudience(value: string): value is PolicyAudience {
  return (POLICY_AUDIENCES as readonly string[]).includes(value);
}

export function policyActive(product: { accessPolicy?: AccessPolicy | null }): boolean {
  const policy = product.accessPolicy;
  if (!policy) return false;
  return (policy.include?.length ?? 0) > 0 || (policy.exclude?.length ?? 0) > 0;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanList(values: readonly string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))];
}

/** Drop blank strings so Firestore never stores an empty gate. */
export function normalisePolicy(policy: AccessPolicy): AccessPolicy {
  const next: AccessPolicy = {
    include: policy.include.filter(isPolicyAudience),
    exclude: policy.exclude.filter(isPolicyAudience),
  };
  if (policy.institutionMode) next.institutionMode = policy.institutionMode;
  const lists: (keyof AccessPolicy)[] = [
    'institutionIds', 'excludeInstitutionIds', 'userIds', 'excludeUserIds',
    'cohortIds', 'excludeCohortIds', 'programmeIds', 'yearGroups', 'levels',
    'countries', 'regions', 'languages', 'bundleIds',
  ];
  for (const key of lists) {
    const value = policy[key];
    if (Array.isArray(value)) {
      const cleaned = key === 'countries'
        ? cleanList(value).map(item => item.toUpperCase())
        : cleanList(value);
      if (cleaned.length) (next as unknown as Record<string, unknown>)[key] = cleaned;
    }
  }
  if (policy.releaseOn) next.releaseOn = policy.releaseOn;
  if (policy.expiresOn) next.expiresOn = policy.expiresOn;
  if (policy.accessDays) next.accessDays = policy.accessDays;
  if (policy.dripMode && policy.dripMode !== 'none') next.dripMode = policy.dripMode;
  if (policy.dripEveryDays) next.dripEveryDays = policy.dripEveryDays;
  if (policy.seatLimit) next.seatLimit = policy.seatLimit;
  // seatsUsed is owned by enrolment. A panel save must not write it back.
  if (policy.sparksCost) next.sparksCost = policy.sparksCost;
  if (policy.trialDays) next.trialDays = policy.trialDays;
  if (typeof policy.freePreviewCount === 'number') next.freePreviewCount = policy.freePreviewCount;
  return next;
}

function viewerDay(viewer: AllocationViewer): string {
  return viewer.now && /^\d{4}-\d{2}-\d{2}$/.test(viewer.now) ? viewer.now : todayIso();
}

function overlaps(left: readonly string[] | null | undefined, right: readonly string[]): boolean {
  const mine = new Set(right);
  return (left ?? []).some(item => mine.has(item));
}

function institutionHit(policy: AccessPolicy, viewer: AllocationViewer, exclude: boolean): boolean {
  if (!viewer.institutionId) return false;
  if (exclude) {
    const blocked = policy.excludeInstitutionIds ?? [];
    if (blocked.includes(viewer.institutionId)) return true;
    return (policy.exclude ?? []).includes('institutions')
      && (policy.institutionMode === 'all' || (policy.institutionIds ?? []).includes(viewer.institutionId));
  }
  if ((policy.excludeInstitutionIds ?? []).includes(viewer.institutionId)) return false;
  if (policy.institutionMode === 'all') return true;
  const ids = policy.institutionIds ?? [];
  return ids.includes(viewer.institutionId);
}

function userHit(policy: AccessPolicy, viewer: AllocationViewer, exclude: boolean): boolean {
  if (exclude) {
    return !!viewer.userId && (policy.excludeUserIds ?? []).includes(viewer.userId) || viewer.revoked === true;
  }
  if (viewer.revoked) return false;
  if (viewer.granted) return true;
  return !!viewer.userId && (policy.userIds ?? []).includes(viewer.userId);
}

function cohortHit(policy: AccessPolicy, viewer: AllocationViewer, exclude: boolean): boolean {
  const ids = exclude ? (policy.excludeCohortIds ?? []) : (policy.cohortIds ?? []);
  return overlaps(viewer.cohortIds, ids);
}

function listHit(policy: AccessPolicy, viewer: AllocationViewer, exclude: boolean): boolean {
  const list = exclude ? policy.exclude : policy.include;
  if (!exclude && list.includes('marketplace')) return true;
  if (exclude && list.includes('marketplace') && viewer.role === 'guest') return true;
  if (viewer.role === 'guest') return false;
  if (list.includes('all')) return true;
  if (list.includes('students') && viewer.role === 'student') return true;
  if (list.includes('teachers') && viewer.role === 'teacher') return true;
  if (list.includes('parents') && viewer.role === 'parent') return true;
  if (list.includes('institutions') && institutionHit(policy, viewer, exclude)) return true;
  if (list.includes('users') && userHit(policy, viewer, exclude)) return true;
  if (list.includes('cohorts') && cohortHit(policy, viewer, exclude)) return true;
  return false;
}

function targetReason(policy: AccessPolicy, viewer: AllocationViewer): string | null {
  if ((policy.programmeIds ?? []).length && !policy.programmeIds!.includes(viewer.programmeId ?? '')) {
    return 'Outside this programme';
  }
  if ((policy.yearGroups ?? []).length && !policy.yearGroups!.includes(viewer.yearGroup ?? '')) {
    return 'Outside this year';
  }
  if ((policy.levels ?? []).length && !policy.levels!.includes(viewer.level ?? '')) {
    return 'Outside this level';
  }
  const country = (viewer.country ?? '').toUpperCase();
  if ((policy.countries ?? []).length && !policy.countries!.includes(country)) {
    return 'Outside this country';
  }
  if ((policy.regions ?? []).length && !policy.regions!.includes(viewer.region ?? '')) {
    return 'Outside this region';
  }
  if ((policy.languages ?? []).length && !policy.languages!.includes(viewer.language ?? 'en')) {
    return 'Not available in this language';
  }
  return null;
}

function hasCoupon(productId: string, viewer: AllocationViewer): boolean {
  return (viewer.permissions ?? []).some(permission => permission.startsWith(`alloc:coupon:${productId}:`))
    || (viewer.couponCourseIds ?? []).includes(productId);
}

function hasBundle(policy: AccessPolicy, viewer: AllocationViewer): boolean {
  return overlaps(viewer.bundleIds, policy.bundleIds ?? []);
}

function sparksOpen(productId: string, viewer: AllocationViewer): boolean {
  return viewer.sparksUnlocked === true
    || (viewer.permissions ?? []).includes(`alloc:sparks:${productId}`);
}

function trialEnded(policy: AccessPolicy, viewer: AllocationViewer, now: string): boolean {
  if (!policy.trialDays || !viewer.trial || !viewer.enrolledOn) return false;
  return addDays(viewer.enrolledOn, policy.trialDays) < now;
}

function accessEnded(policy: AccessPolicy, viewer: AllocationViewer, now: string): boolean {
  if (policy.expiresOn && policy.expiresOn < now) return true;
  if (policy.accessDays && viewer.enrolledOn && addDays(viewer.enrolledOn, policy.accessDays) < now) return true;
  return false;
}

/**
 * Catalogue and lesson access once a policy exists.
 * Callers handle platform admins and owners before this.
 */
export function evaluatePolicy(
  product: AllocatableProduct & { accessPolicy: AccessPolicy },
  viewer: AllocationViewer,
): AccessDecision {
  const policy = product.accessPolicy;
  const now = viewerDay(viewer);
  const published = product.status === 'published';

  const userExcluded = !!viewer.userId && (policy.excludeUserIds ?? []).includes(viewer.userId);
  const schoolExcluded = !!viewer.institutionId && (policy.excludeInstitutionIds ?? []).includes(viewer.institutionId);
  const cohortExcluded = overlaps(viewer.cohortIds, policy.excludeCohortIds ?? []);
  if (viewer.revoked || userExcluded || schoolExcluded || cohortExcluded || listHit(policy, viewer, true)) {
    return { listed: false, open: false, reason: 'Excluded' };
  }
  if (!published && !viewer.enrolled) {
    return { listed: false, open: false, reason: 'Not published' };
  }

  const included = listHit(policy, viewer, false);
  if (!included && !viewer.enrolled) {
    if ((policy.include ?? []).includes('institutions') && policy.institutionMode !== 'all' && !(policy.institutionIds ?? []).length) {
      return { listed: false, open: false, reason: 'No institution selected' };
    }
    return { listed: false, open: false, reason: 'Not allocated to this audience' };
  }

  const target = targetReason(policy, viewer);
  if (target && !viewer.enrolled) {
    return { listed: false, open: false, reason: target };
  }

  if (policy.releaseOn && policy.releaseOn > now) {
    return { listed: true, open: false, reason: `Releases ${policy.releaseOn}` };
  }
  if (accessEnded(policy, viewer, now)) {
    return { listed: true, open: false, reason: 'Access ended' };
  }
  if (!viewer.enrolled && policy.seatLimit && (policy.seatsUsed ?? 0) >= policy.seatLimit) {
    return { listed: true, open: false, reason: 'No seats left' };
  }
  if (trialEnded(policy, viewer, now) && !hasCoupon(product.id, viewer) && !sparksOpen(product.id, viewer)) {
    return { listed: true, open: false, reason: 'Trial ended' };
  }
  if (hasBundle(policy, viewer) || hasCoupon(product.id, viewer)) {
    return { listed: true, open: true, reason: hasCoupon(product.id, viewer) ? 'Coupon' : 'Included in a bundle' };
  }
  if (viewer.enrolled && !viewer.trial) {
    return { listed: true, open: true, reason: 'Already enrolled' };
  }

  return priceDecision(product, viewer, true);
}

export function priceDecision(
  product: AllocatableProduct,
  viewer: AllocationViewer,
  listed: boolean,
): AccessDecision {
  const priceType = product.priceType;
  if (priceType === 'FREE') return { listed, open: true, reason: 'Free' };
  if (priceType === 'SPARKS_UNLOCK') {
    return sparksOpen(product.id, viewer)
      ? { listed, open: true, reason: 'Unlocked with Sparks' }
      : { listed, open: false, reason: 'Unlock with Sparks' };
  }
  if (priceType === 'INSTITUTION_ALLOCATED') {
    const schools = product.accessPolicy?.institutionIds ?? product.allocatedInstitutionIds ?? [];
    const mode = product.accessPolicy?.institutionMode;
    const inSchool = !!viewer.institutionId && (mode === 'all' || schools.includes(viewer.institutionId));
    return inSchool
      ? { listed, open: true, reason: 'Allocated to this institution' }
      : { listed, open: false, reason: 'Institution allocation required' };
  }
  if (priceType === 'MARKETPLACE_PURCHASE' || priceType === 'COUPON_SCHOLARSHIP') {
    const purchased = (viewer.permissions ?? []).includes(`alloc:marketplace:${product.id}`)
      || (viewer.permissions ?? []).includes(`alloc:book:${product.id}`);
    if (purchased || hasCoupon(product.id, viewer)) {
      return { listed, open: true, reason: purchased ? 'Purchased' : 'Coupon' };
    }
    if (product.accessPolicy?.trialDays && viewer.enrolled && viewer.trial) {
      return { listed, open: true, reason: 'Trial' };
    }
    return {
      listed,
      open: false,
      reason: priceType === 'COUPON_SCHOLARSHIP' ? 'A coupon is required' : 'Purchase required',
    };
  }
  return { listed, open: true, reason: 'Included' };
}

export function lessonWindow(
  policy: AccessPolicy | null | undefined,
  viewer: AllocationViewer,
  lessonIndex: number,
  unitIndex: number,
): AccessDecision {
  const now = viewerDay(viewer);
  const preview = policy?.freePreviewCount ?? 0;
  if (!viewer.enrolled && lessonIndex >= 0 && lessonIndex < preview) {
    return { listed: true, open: true, reason: 'Free preview' };
  }
  if (policy && accessEnded(policy, viewer, now)) {
    return { listed: true, open: false, reason: 'Access ended' };
  }
  if (policy && trialEnded(policy, viewer, now)) {
    return { listed: true, open: false, reason: 'Trial ended' };
  }
  const every = policy?.dripEveryDays ?? 0;
  if (viewer.enrolled && viewer.enrolledOn && policy?.dripMode === 'lesson' && every > 0) {
    const openOn = addDays(viewer.enrolledOn, Math.max(0, lessonIndex) * every);
    if (openOn > now) return { listed: true, open: false, reason: `Opens ${openOn}` };
  }
  if (viewer.enrolled && viewer.enrolledOn && policy?.dripMode === 'unit' && every > 0) {
    const openOn = addDays(viewer.enrolledOn, Math.max(0, unitIndex) * every);
    if (openOn > now) return { listed: true, open: false, reason: `Opens ${openOn}` };
  }
  if (!viewer.enrolled) return { listed: true, open: false, reason: 'Enrol to open this lesson' };
  return { listed: true, open: true, reason: 'Open' };
}

export function describeAccess(product: AllocatableProduct): string {
  const policy = product.accessPolicy;
  if (!policyActive(product) || !policy) {
    const audiences = product.audiences ?? [];
    if (!audiences.length) return 'No custom audience yet. The earlier public rules still apply.';
    return `Visible to ${audiences.join(', ')}.`;
  }
  const include = policy.include.map(item => POLICY_AUDIENCE_LABELS[item]).join(', ') || 'nobody';
  const exclude = policy.exclude.length
    ? ` Hidden from ${policy.exclude.map(item => POLICY_AUDIENCE_LABELS[item]).join(', ')}.`
    : '';
  const schools = policy.institutionMode === 'all'
    ? ' Every institution.'
    : (policy.institutionIds?.length ? ` ${policy.institutionIds.length} institution${policy.institutionIds.length === 1 ? '' : 's'}.` : '');
  const price = product.priceType ? ` Price: ${product.priceType.replaceAll('_', ' ').toLowerCase()}.` : '';
  const when = [
    policy.releaseOn ? `releases ${policy.releaseOn}` : '',
    policy.expiresOn ? `ends ${policy.expiresOn}` : '',
    policy.accessDays ? `${policy.accessDays} days of access` : '',
    policy.dripMode && policy.dripMode !== 'none' ? `drip by ${policy.dripMode} every ${policy.dripEveryDays ?? 1} days` : '',
    policy.seatLimit ? `${policy.seatsUsed ?? 0}/${policy.seatLimit} seats` : '',
    policy.trialDays ? `${policy.trialDays}-day trial` : '',
    typeof policy.freePreviewCount === 'number' ? `${policy.freePreviewCount} preview lessons` : '',
  ].filter(Boolean).join(', ');
  return `Visible to ${include}.${schools}${exclude}${price}${when ? ` ${when}.` : ''}`;
}

export interface BulkRow {
  id: string;
  action: 'grant' | 'revoke';
}

/** CSV with an optional header. A row is an email or a user id, then grant or revoke. */
export function parseAllocationCsv(text: string): { rows: BulkRow[]; errors: string[] } {
  const rows: BulkRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    const [rawId, rawAction] = line.split(',').map(part => part.trim());
    if (/^e-?mail$/i.test(rawId) && index === 0) return;
    const action = (rawAction ?? 'grant').toLowerCase();
    if (action !== 'grant' && action !== 'revoke') {
      errors.push(`Line ${index + 1}: action must be grant or revoke.`);
      return;
    }
    const id = rawId.toLowerCase();
    const email = id.includes('@') && id.includes('.');
    const uid = /^[a-z0-9]{10,}$/i.test(rawId);
    if (!email && !uid) {
      errors.push(`Line ${index + 1}: use an email or a user id.`);
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ id: email ? id : rawId, action });
  });
  return { rows, errors };
}
