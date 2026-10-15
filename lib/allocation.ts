/**
 * Who may see a product, and who may open its lessons.
 *
 * Audiences decide the catalogue. Tier and price type, from lib/entitlements.ts,
 * decide whether the lessons open. A course with no `audiences` field keeps the
 * older behaviour so existing documents do not disappear.
 */

import {
  accessTierFor,
  allocBook,
  allocMarketplace,
  checkEntitlement,
  courseMinTier,
  coursePriceType,
  permissionsFor,
  type AccessTier,
  type PriceType,
} from './entitlements';
import { evaluatePolicy, policyActive, priceDecision, type AccessPolicy } from './access-policy';
import { anyTargetMatch, migrateAllocation, normaliseTargets } from './allocation-targets';

export const AUDIENCES = ['students', 'teachers', 'parents', 'institutions', 'all', 'marketplace'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  students: 'Students',
  teachers: 'Teachers',
  parents: 'Parents',
  institutions: 'Specific institutions',
  all: 'All signed-in roles',
  marketplace: 'Marketplace (public sale)',
};

export type ViewerRole = 'guest' | 'student' | 'teacher' | 'parent' | 'institution_admin' | 'admin';

export interface AllocationViewer {
  role: ViewerRole;
  institutionId?: string | null;
  accessTier?: number | null;
  subscriptionTier?: string | null;
  permissions?: string[] | null;
  enrolled?: boolean;
  /** The signed-in user owns this product. */
  isOwner?: boolean;
  userId?: string | null;
  cohortIds?: string[] | null;
  yearGroup?: string | null;
  level?: string | null;
  programmeId?: string | null;
  country?: string | null;
  region?: string | null;
  language?: string | null;
  /** YYYY-MM-DD. Tests pin this so a release date does not depend on the clock. */
  now?: string | null;
  enrolledOn?: string | null;
  granted?: boolean;
  revoked?: boolean;
  sparksUnlocked?: boolean;
  trial?: boolean;
  bundleIds?: string[] | null;
  couponCourseIds?: string[] | null;
}

export interface AllocatableProduct {
  id: string;
  status?: string | null;
  audiences?: readonly Audience[] | null;
  allocatedInstitutionIds?: string[] | null;
  minTier?: number | null;
  priceType?: string | null;
  kind?: string | null;
  level?: string | null;
  price?: number | null;
  isPublic?: boolean | null;
  publishScope?: string | null;
  contentType?: string | null;
  accessPolicy?: AccessPolicy | null;
  /** Shared allocation list. Any matching target can see the product. */
  targets?: readonly string[] | null;
  viewCount?: number | null;
  enrollmentCount?: number | null;
  completionCount?: number | null;
  revenueTotal?: number | null;
}

export interface ProductAccess {
  /** The card or the landing page. */
  listed: boolean;
  /** The lessons. */
  open: boolean;
  reason: string;
}

export function isAudience(value: string): value is Audience {
  return (AUDIENCES as readonly string[]).includes(value);
}

export function audiencesOf(product: { audiences?: readonly string[] | null }): Audience[] {
  return (product.audiences ?? []).filter(isAudience);
}

function published(product: AllocatableProduct): boolean {
  return product.status === 'published';
}

function legacyListed(product: AllocatableProduct, viewer: AllocationViewer): boolean {
  if (!published(product)) return false;
  if (viewer.role === 'guest') {
    return product.isPublic === true || product.publishScope === 'public' || product.publishScope === 'marketplace';
  }
  return true;
}

function audienceListed(product: AllocatableProduct, viewer: AllocationViewer, audiences: Audience[]): boolean {
  if (!published(product)) return false;
  if (audiences.includes('marketplace')) return true;
  if (viewer.role === 'guest') return false;
  if (audiences.includes('all')) return true;
  if (viewer.role === 'student' && audiences.includes('students')) return true;
  if (viewer.role === 'teacher' && audiences.includes('teachers')) return true;
  if (viewer.role === 'parent' && audiences.includes('parents')) return true;
  if (audiences.includes('institutions')) {
    const schools = product.allocatedInstitutionIds ?? [];
    return !!viewer.institutionId && schools.includes(viewer.institutionId);
  }
  return false;
}

function contentTypeFor(product: AllocatableProduct): string {
  if (product.kind === 'book') return 'BOOK';
  if (product.contentType) return product.contentType;
  if (coursePriceType(product) === 'MARKETPLACE_PURCHASE') return 'MARKETPLACE_PURCHASE';
  return 'COURSE_IGCSE';
}

/**
 * Catalogue plus lesson access for one viewer.
 * Admins, owners, and people already enrolled are never hidden.
 */
export function productAccess(product: AllocatableProduct, viewer: AllocationViewer): ProductAccess {
  if (viewer.role === 'admin' || viewer.isOwner) {
    return { listed: true, open: true, reason: viewer.role === 'admin' ? 'Platform admin' : 'You own this' };
  }
  const explicitTargets = normaliseTargets(product.targets ?? []);
  const audiences = audiencesOf(product);
  const targets = explicitTargets.length
    ? explicitTargets
    : (!policyActive(product) && audiences.length === 0
      ? migrateAllocation({
          publishScope: product.publishScope,
          allocatedInstitutionIds: product.allocatedInstitutionIds,
        })
      : []);

  if (policyActive(product) && product.accessPolicy) {
    const decision = evaluatePolicy({ ...product, accessPolicy: product.accessPolicy }, viewer);
    if (!(decision.open && decision.reason === 'Included')) return decision;
  } else if (viewer.enrolled) {
    return { listed: true, open: true, reason: 'Already enrolled' };
  } else if (targets.length) {
    if (!published(product)) return { listed: false, open: false, reason: 'Not published' };
    const match = anyTargetMatch(targets, viewer);
    if (!match.hit) return { listed: false, open: false, reason: match.reason ?? 'Not allocated to this audience' };
  } else {
    const listed = audiences.length === 0
      ? legacyListed(product, viewer)
      : audienceListed(product, viewer, audiences);

    if (!listed) {
      if (!published(product)) return { listed: false, open: false, reason: 'Not published' };
      if (audiences.includes('institutions') && !(product.allocatedInstitutionIds ?? []).length) {
        return { listed: false, open: false, reason: 'No institution selected' };
      }
      return { listed: false, open: false, reason: 'Not allocated to this audience' };
    }
  }

  const priceType = coursePriceType(product);
  if (priceType === 'FREE') {
    return { listed: true, open: true, reason: 'Free' };
  }
  if (priceType === 'INSTITUTION_ALLOCATED') {
    const schools = product.allocatedInstitutionIds ?? [];
    const inSchool = !!viewer.institutionId && schools.includes(viewer.institutionId);
    return inSchool
      ? { listed: true, open: true, reason: 'Allocated to this institution' }
      : { listed: true, open: false, reason: 'Institution allocation required' };
  }
  if (priceType === 'SPARKS_UNLOCK') {
    return priceDecision(product, viewer, true);
  }
  if (priceType === 'MARKETPLACE_PURCHASE') {
    const held = permissionsFor({
      role: viewer.role === 'guest' ? null : viewer.role,
      accessTier: viewer.accessTier,
      subscriptionTier: viewer.subscriptionTier,
      permissions: viewer.permissions,
    });
    return held.includes(allocMarketplace(product.id)) || held.includes(allocBook(product.id))
      ? { listed: true, open: true, reason: 'Purchased' }
      : { listed: true, open: false, reason: 'Purchase required' };
  }

  const permissions = permissionsFor({
    role: viewer.role === 'guest' ? null : viewer.role,
    accessTier: viewer.accessTier,
    subscriptionTier: viewer.subscriptionTier,
    permissions: viewer.permissions,
  });
  const gate = checkEntitlement(permissions, contentTypeFor(product), {
    courseId: product.id,
    userTier: accessTierFor({
      role: viewer.role === 'guest' ? null : viewer.role,
      accessTier: viewer.accessTier,
      subscriptionTier: viewer.subscriptionTier,
    }),
    minTier: courseMinTier(product),
    priceType,
  });

  if (!gate.allowed) {
    return {
      listed: true,
      open: false,
      reason: gate.reason === 'PAYMENT_REQUIRED' ? 'Purchase required' : 'A higher plan is required',
    };
  }
  return { listed: true, open: true, reason: 'Included' };
}

export interface PreviewRole {
  id: ViewerRole;
  label: string;
}

export const PREVIEW_ROLES: PreviewRole[] = [
  { id: 'guest', label: 'Guest' },
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'parent', label: 'Parent' },
  { id: 'institution_admin', label: 'Institution' },
  { id: 'admin', label: 'Platform admin' },
];

/** A viewer standing in for the allocation preview. Tier 0 is a guest plan. */
export function previewViewer(
  role: ViewerRole,
  opts: { institutionId?: string | null; accessTier?: AccessTier; enrolled?: boolean } = {},
): AllocationViewer {
  return {
    role,
    institutionId: opts.institutionId ?? null,
    accessTier: role === 'guest' ? 0 : (opts.accessTier ?? (role === 'student' ? 2 : role === 'admin' ? 5 : 1)),
    enrolled: opts.enrolled ?? false,
  };
}

export function viewerFromProfile(
  profile: {
    id?: string | null;
    role?: string | null;
    institutionId?: string | null;
    accessTier?: number | null;
    subscriptionTier?: string | null;
    permissions?: string[] | null;
    yearGroup?: string | null;
    level?: string | null;
    country?: string | null;
    region?: string | null;
    language?: string | null;
    programmeId?: string | null;
    cohortIds?: string[] | null;
  } | null | undefined,
  opts: { enrolled?: boolean; isOwner?: boolean; userId?: string | null } = {},
): AllocationViewer {
  const role = profile?.role;
  const known: ViewerRole = role === 'student' || role === 'teacher' || role === 'parent'
    || role === 'institution_admin' || role === 'admin'
    ? role
    : 'guest';
  return {
    role: known,
    institutionId: profile?.institutionId ?? null,
    accessTier: profile?.accessTier,
    subscriptionTier: profile?.subscriptionTier,
    permissions: profile?.permissions,
    enrolled: opts.enrolled,
    isOwner: opts.isOwner,
    userId: opts.userId ?? profile?.id ?? null,
    yearGroup: profile?.yearGroup,
    level: profile?.level,
    country: profile?.country,
    region: profile?.region,
    language: profile?.language,
    programmeId: profile?.programmeId,
    cohortIds: profile?.cohortIds,
  };
}

export function normaliseAudiences(values: readonly string[]): Audience[] {
  const seen = new Set<Audience>();
  for (const value of values) {
    if (isAudience(value)) seen.add(value);
  }
  return AUDIENCES.filter(audience => seen.has(audience));
}

export type { PriceType };
