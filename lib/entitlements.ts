import { canonicalProgramme, programmeByValue } from './programmes';

/**
 * Access tiers, content types and entitlement checking.
 *
 * Implements the model in the Entitlements Brief and the Product & Course
 * Pricing Addendum (August 2026). Two gates run in sequence for every piece of
 * content:
 *
 *   Gate 1 — access tier:  userAccessTier >= content.minTier
 *   Gate 2 — price type:   is it included, purchased, allocated, or free?
 *
 * Both must pass. Manual allocations (scholarships, institution contracts,
 * marketplace purchases) can override either gate.
 *
 * Backward compatibility matters more than purity here: the platform shipped
 * with a binary `subscriptionTier` of 'free' | 'academic', and thousands of
 * existing course documents have no minTier or priceType. Everything in this
 * module derives a sensible value when the new fields are absent, so nothing
 * breaks before the data is backfilled.
 */

/* ── Access tiers ────────────────────────────────────────────── */

export type AccessTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TierDefinition {
  tier: AccessTier;
  id: string;
  name: string;
  blurb: string;
  /**
   * Monthly Sparks allowance and rollover are product constants for gates and
   * copy. Charged prices and the displayed allowance live in lib/pricing.ts.
   */
  sparks: number;
  /** Sparks that roll over into the next month. */
  sparksRollover: number;
  programmes: string[];
}

/**
 * The seven tiers. Tier 3 and 4 are the same commercial plan — "Professional &
 * Degrees" — because LLB unlocks inside it; the brief keeps them as separate
 * minTier values so law content can be gated independently.
 */
export const TIERS: TierDefinition[] = [
  {
    tier: 0, id: 'preview', name: 'Free Preview',
    blurb: 'Public access, no account required.',
    sparks: 0, sparksRollover: 0,
    programmes: [
      'Course catalogue',
      'First lesson of any course',
      'Certificate verification',
      '53 languages',
      'Free digital student card',
      'Free Amber alerts',
    ],
  },
  {
    tier: 1, id: 'primary_secondary', name: 'Primary & Lower Secondary',
    blurb: 'Primary and Lower Secondary, entry-level individual subscription.',
    sparks: 300, sparksRollover: 100,
    programmes: [
      'Primary',
      'Lower Secondary',
      'ET AI Studio and ET Maths',
      'Poket Reads books and audiobooks',
      '53 languages',
    ],
  },
  {
    tier: 2, id: 'igcse_alevel', name: 'IGCSE & A-Level',
    blurb: 'IGCSE to A-Level, the core academic subscription.',
    sparks: 800, sparksRollover: 300,
    programmes: [
      'IGCSE / GCSE',
      'A-Level',
      'Pre-University',
      'Everything in Primary & Lower Secondary',
      'ET AI Studio, ET Maths and ET Exams',
      'ET AI Essay Writer — AI-graded 9-1 / A*-U',
      'Open Badges 3.0 certificates with LinkedIn sharing',
      'Downloadable transcripts',
      'Parent dashboard and reports',
      'Attendance and daily goals',
      'ET AI Live add-on',
    ],
  },
  {
    tier: 3, id: 'professional', name: 'Professional & Degrees',
    blurb: 'MBBS Medicine, LLB Law (University of London and other universities), Engineering and Nursing.',
    sparks: 1000, sparksRollover: 700,
    programmes: [
      'LLB Law — University of London (UoL) and other universities',
      'MBBS Medicine — ET Medicine',
      'Engineering — ET Engineering',
      'Nursing — ET Nursing',
      'Micro Degrees and Diplomas',
      'Professional Certifications',
      'Independent Learning — open',
      'Everything in IGCSE & A-Level',
      'ET AI Live add-on',
    ],
  },
  {
    tier: 4, id: 'llb', name: 'Law & LLB',
    blurb: 'LLB Law covers the University of London (UoL) and other universities. Unlocks within Professional & Degrees.',
    sparks: 1000, sparksRollover: 700,
    programmes: ['LLB Law — University of London (UoL) and other universities', 'A-Level Law', 'Pre-University Law', 'Everything in Professional & Degrees'],
  },
  {
    tier: 5, id: 'institution', name: 'Institution',
    blurb: 'Annual contract for schools, learning centres and exam centres. Sparks are a pooled per-seat allowance, not an unlimited balance.',
    sparks: 0, sparksRollover: 0,
    programmes: ['Everything in Professional & Degrees', 'Teacher CMS', 'Institution admin dashboard', 'Pooled Sparks by seat', 'White-label'],
  },
  {
    tier: 6, id: 'marketplace', name: 'Marketplace',
    blurb: 'Buy a single course outright. No subscription required.',
    sparks: 0, sparksRollover: 0,
    programmes: ['Any individual course', 'Permanent access after purchase'],
  },
];

export function tierDefinition(tier: AccessTier): TierDefinition {
  return TIERS.find(t => t.tier === tier) ?? TIERS[0];
}

/** Plan bullets shown on pricing cards and at checkout. */
export function planProgrammes(id: string): string[] {
  return TIERS.find(tier => tier.id === id)?.programmes ?? [];
}

/* ── Content types ───────────────────────────────────────────── */

export type ContentType =
  | 'FREE_PREVIEW' | 'MARKETPLACE_BROWSE'
  | 'ET_AI_STUDIO'
  | 'COURSE_PRIMARY' | 'COURSE_SECONDARY' | 'COURSE_IGCSE' | 'COURSE_ALEVEL'
  | 'COURSE_PRE_UNIVERSITY' | 'COURSE_LLB' | 'COURSE_MBBS' | 'COURSE_ENGINEERING' | 'COURSE_NURSING'
  | 'COURSE_MICRO_DEGREE'
  | 'COURSE_PROFESSIONAL_CERT' | 'COURSE_INDEPENDENT'
  | 'AI_TUTOR_SESSION' | 'AI_TUTOR_LAW' | 'ET_AI_LIVE'
  | 'BLOOM_TRACKING' | 'GOALS_LINKED' | 'PARENT_DASHBOARD' | 'CERTIFICATE'
  | 'MARKETPLACE_PURCHASE' | 'MARKETPLACE_LIST'
  | 'GRADEBOOK' | 'ATTENDANCE' | 'EXAM_BUILDER' | 'REPORT_CARD' | 'LIVE_CLASS'
  | 'INTEGRITY_MONITOR' | 'BEHAVIOUR_LOG'
  | 'INSTITUTION_ADMIN' | 'PLATFORM_ADMIN'
  | 'BOOK';

/** contentType → the permission string that satisfies it. */
export const PLAN_MAP: Record<string, string> = {
  COURSE_PRIMARY: 'plan:primary',
  COURSE_SECONDARY: 'plan:secondary',
  COURSE_IGCSE: 'plan:igcse',
  COURSE_ALEVEL: 'plan:alevel',
  COURSE_PRE_UNIVERSITY: 'plan:pre_university',
  COURSE_LLB: 'plan:llb',
  COURSE_MBBS: 'plan:mbbs',
  COURSE_ENGINEERING: 'plan:engineering',
  COURSE_NURSING: 'plan:nursing',
  COURSE_MICRO_DEGREE: 'plan:micro_degree',
  COURSE_PROFESSIONAL_CERT: 'plan:professional_cert',
  COURSE_INDEPENDENT: 'plan:independent',
  ET_AI_STUDIO: 'et_ai:studio',
  AI_TUTOR_SESSION: 'plan:ai_tutor',
  AI_TUTOR_LAW: 'plan:llb',
  ET_AI_LIVE: 'addon:et_ai_live',
  /** Grants written before the rename. Readers still accept this. */
  ET_AI_LIVE_LEGACY: 'addon:lyra_live',
  BLOOM_TRACKING: 'plan:bloom_tracking',
  GOALS_LINKED: 'plan:goals_linked',
  PARENT_DASHBOARD: 'plan:parent_dashboard',
  CERTIFICATE: 'plan:certificate',
  GRADEBOOK: 'role:teacher_cms',
  ATTENDANCE: 'role:teacher_cms',
  EXAM_BUILDER: 'role:teacher_cms',
  REPORT_CARD: 'role:teacher_cms',
  LIVE_CLASS: 'role:teacher_cms',
  INTEGRITY_MONITOR: 'role:teacher_cms',
  BEHAVIOUR_LOG: 'role:teacher_cms',
  INSTITUTION_ADMIN: 'role:institution_admin',
  MARKETPLACE_PURCHASE: 'plan:marketplace_purchase',
  MARKETPLACE_LIST: 'role:marketplace_list',
  PLATFORM_ADMIN: 'role:platform_admin',
};

/** The minimum access tier each content type needs. */
export const CONTENT_MIN_TIER: Record<string, AccessTier> = {
  FREE_PREVIEW: 0, MARKETPLACE_BROWSE: 0,
  COURSE_PRIMARY: 1, COURSE_SECONDARY: 1,
  COURSE_IGCSE: 2, COURSE_ALEVEL: 2, COURSE_PRE_UNIVERSITY: 2, COURSE_INDEPENDENT: 2,
  ET_AI_STUDIO: 1, AI_TUTOR_SESSION: 2, BLOOM_TRACKING: 2, GOALS_LINKED: 2,
  PARENT_DASHBOARD: 2, CERTIFICATE: 2, ET_AI_LIVE: 2,
  COURSE_MICRO_DEGREE: 3, COURSE_PROFESSIONAL_CERT: 3,
  COURSE_LLB: 3, COURSE_MBBS: 3, COURSE_ENGINEERING: 3, COURSE_NURSING: 3, AI_TUTOR_LAW: 3,
  GRADEBOOK: 5, ATTENDANCE: 5, EXAM_BUILDER: 5, REPORT_CARD: 5, LIVE_CLASS: 5,
  INTEGRITY_MONITOR: 5, BEHAVIOUR_LOG: 5, INSTITUTION_ADMIN: 5, MARKETPLACE_LIST: 5,
  MARKETPLACE_PURCHASE: 6,
  PLATFORM_ADMIN: 5,
  BOOK: 0,
};

/* ── Price types ─────────────────────────────────────────────── */

export type PriceType =
  | 'FREE'
  | 'FREE_PREVIEW'
  | 'SUBSCRIPTION_INCLUDED'
  | 'MARKETPLACE_PURCHASE'
  | 'INSTITUTION_ALLOCATED'
  | 'COUPON_SCHOLARSHIP'
  | 'SPARKS_UNLOCK';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  FREE: 'Free',
  FREE_PREVIEW: 'Free preview, then paid',
  SUBSCRIPTION_INCLUDED: 'Included in a plan',
  MARKETPLACE_PURCHASE: 'One-time purchase',
  INSTITUTION_ALLOCATED: 'Allocated',
  COUPON_SCHOLARSHIP: 'Coupon or scholarship',
  SPARKS_UNLOCK: 'Sparks unlock',
};

/** Default number of free lessons at the start of a paid course. */
export const DEFAULT_FREE_PREVIEW_COUNT = 1;

/* ── Permission strings ──────────────────────────────────────── */

export const allocFree = (courseId: string) => `alloc:free:${courseId}`;
export const allocPaid = (courseId: string) => `alloc:paid:${courseId}`;
export const allocMarketplace = (courseId: string) => `alloc:marketplace:${courseId}`;
export const allocBook = (productId: string) => `alloc:book:${productId}`;
export const allocCoupon = (courseId: string, expiry: string) => `alloc:coupon:${courseId}:${expiry}`;
export const allocInstitution = (instId: string, courseId: string) =>
  `alloc:institution:${instId}:${courseId}`;
/** Creator-store allocation. Same permission list as course allocations. */
export const allocResource = (resourceId: string) => `alloc:resource:${resourceId}`;

/* ── Add-ons ─────────────────────────────────────────────────── */

export interface AddOn {
  id: string;
  permission: string;
  name: string;
  blurb: string;
  /** Base tier required before the add-on can be bought. */
  requiresTier: AccessTier;
  /** Shown instead of a price when Harry has not set one. */
  priceNote?: string;
  requiresLabel?: string;
}

/**
 * Add-ons are bought on top of a qualifying plan and are independent of it —
 * cancelling the add-on leaves the plan intact, and vice versa.
 */
export const ADDONS: AddOn[] = [
  {
    id: 'et_ai_live',
    permission: 'addon:et_ai_live',
    name: 'ET AI Live',
    blurb: 'Real-time face-to-face sessions with an AI teacher who sees and hears you.',
    requiresTier: 2,
  },
  {
    id: 'cms',
    permission: 'addon:cms',
    name: 'CMS',
    blurb: 'Shared editor, document import, image library, illustrations, and course or book covers.',
    requiresTier: 5,
  },
  {
    id: 'et_ai_timetabler',
    permission: 'addon:et_ai_timetabler',
    name: 'ET AI Timetabler',
    blurb: 'Builds a weekly timetable for a teacher’s private classrooms, or for a whole school on Institution and Enterprise.',
    requiresTier: 5,
    priceNote: 'TBC by Harry',
    requiresLabel: 'Teacher plans get a personal timetable. Institution and Enterprise get the school timetable. Enterprise can use more than one campus.',
  },
];

export function addOn(id: string): AddOn | undefined {
  return ADDONS.find(a => a.id === id);
}

/** Does this permission set include a given add-on? Super admins always do. */
export function hasAddOn(permissions: string[], id: string): boolean {
  if (permissions.includes('role:super_admin')) return true;
  const resolved = id === 'lyra_live' ? 'et_ai_live' : id;
  const a = addOn(resolved);
  if (!a) return false;
  if (permissions.includes(a.permission)) return true;
  return a.id === 'et_ai_live' && permissions.includes('addon:lyra_live');
}

/**
 * The shared editor and media tools.
 * A platform admin always has them. A teacher or institution admin has them
 * when `addon:cms` is on their account.
 */
export function hasCmsAddon(
  profile: {
    role?: string | null;
    permissions?: string[] | null;
    accessTier?: number | null;
    subscriptionTier?: string | null;
  } | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return hasAddOn(permissionsFor(profile), 'cms');
}

/** Permissions implied by an access tier. Cumulative — each tier includes those below. */
export function permissionsForTier(tier: AccessTier): string[] {
  const p = ['free:preview', 'plan:marketplace_purchase'];
  if (tier >= 1) p.push('et_ai:studio', 'plan:primary', 'plan:secondary');
  if (tier >= 2) {
    p.push('plan:igcse', 'plan:alevel', 'plan:pre_university', 'plan:independent',
      'plan:ai_tutor', 'plan:bloom_tracking', 'plan:goals_linked',
      'plan:parent_dashboard', 'plan:certificate');
  }
  if (tier >= 3) p.push('plan:micro_degree', 'plan:professional_cert');
  if (tier >= 3) p.push('plan:llb', 'plan:mbbs', 'plan:engineering', 'plan:nursing');
  return p;
}

/** Permissions implied by a role. */
export function permissionsForRole(role: string | null | undefined): string[] {
  switch (role) {
    case 'admin': return ['role:super_admin', 'role:platform_admin'];
    case 'institution_admin': return ['role:institution_admin', 'role:teacher_cms'];
    case 'teacher': return ['role:teacher_cms'];
    default: return [];
  }
}

/* ── Legacy mapping ──────────────────────────────────────────── */

/**
 * The access tier for a profile.
 *
 * Prefers an explicit `accessTier`. Falls back to the original binary
 * subscriptionTier so accounts created before tiers existed keep exactly the
 * access they had: 'academic' behaved like the IGCSE & A-Level plan, and
 * everyone else could still browse and buy on the marketplace.
 */
export function accessTierFor(
  profile: { accessTier?: number | null; subscriptionTier?: string | null; role?: string | null } | null | undefined,
): AccessTier {
  if (!profile) return 0;
  // Staff are never gated by a subscription.
  if (profile.role === 'admin') return 5;
  if (profile.role === 'institution_admin' || profile.role === 'teacher') return 5;
  const explicit = profile.accessTier;
  if (typeof explicit === 'number' && explicit >= 0 && explicit <= 6) return explicit as AccessTier;
  return profile.subscriptionTier === 'academic' ? 2 : 6;
}

/** Everything a user is entitled to, derived from tier + role + stored allocations. */
export function permissionsFor(
  profile: {
    accessTier?: number | null; subscriptionTier?: string | null;
    role?: string | null; permissions?: string[] | null;
  } | null | undefined,
): string[] {
  if (!profile) return ['free:preview'];
  const tier = accessTierFor(profile);
  return Array.from(new Set([
    ...permissionsForTier(tier),
    ...permissionsForRole(profile.role),
    ...(profile.permissions ?? []),
  ]));
}

/* ── The checker ─────────────────────────────────────────────── */

export interface EntitlementResult {
  allowed: boolean;
  /** Why it failed, for the paywall the frontend shows. */
  reason?: 'UPGRADE_REQUIRED' | 'PAYMENT_REQUIRED' | 'SIGN_IN_REQUIRED';
  /** Tier the user needs to reach, when the tier gate failed. */
  requiredTier?: AccessTier;
}

const ALLOWED: EntitlementResult = { allowed: true };

/** Has this coupon permission expired? Strings carry `:YYYY-MM-DD` at the end. */
function couponLive(permission: string): boolean {
  const expiry = permission.split(':').pop();
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return true;
  // Compare date-only so a coupon lasts through its final day.
  return expiry >= new Date().toISOString().slice(0, 10);
}

/**
 * Gate 1 + Gate 2, in that order, exactly as the addendum specifies.
 *
 * Allocations are checked first because they override both gates — except
 * `alloc:paid`, which activates a route but still requires the plan.
 */
export function checkEntitlement(
  permissions: string[],
  contentType: ContentType | string,
  opts: {
    courseId?: string;
    userTier?: AccessTier;
    minTier?: AccessTier;
    priceType?: PriceType;
  } = {},
): EntitlementResult {
  const perms = permissions ?? [];

  // Super admin bypasses everything.
  if (perms.includes('role:super_admin')) return ALLOWED;

  // Public content needs no account at all.
  if (contentType === 'FREE_PREVIEW' || contentType === 'MARKETPLACE_BROWSE') return ALLOWED;

  const { courseId, priceType } = opts;
  const userTier = opts.userTier ?? 0;
  const minTier = opts.minTier ?? CONTENT_MIN_TIER[contentType] ?? 0;

  // Manual allocations override the gates.
  let paidAllocation = false;
  if (courseId) {
    if (perms.includes(allocFree(courseId))) return ALLOWED;
    if (perms.includes(allocMarketplace(courseId)) || perms.includes(allocBook(courseId))) return ALLOWED;
    if (perms.some(p => p.startsWith(`alloc:coupon:${courseId}:`) && couponLive(p))) return ALLOWED;

    const institutionRe = new RegExp(`^alloc:institution:[^:]+:${courseId}$`);
    if (perms.some(p => institutionRe.test(p))) return ALLOWED;

    // alloc:paid activates the route but the plan gate below still applies.
    paidAllocation = perms.includes(allocPaid(courseId));
  }

  // Gate 1 — access tier.
  if (userTier < minTier) {
    return { allowed: false, reason: 'UPGRADE_REQUIRED', requiredTier: minTier };
  }

  // Gate 2 — price type.
  if (priceType === 'MARKETPLACE_PURCHASE' && !paidAllocation) {
    // Reaching here means no marketplace allocation was found above.
    return { allowed: false, reason: 'PAYMENT_REQUIRED' };
  }

  const required = PLAN_MAP[contentType];
  if (!required) return ALLOWED;
  return perms.includes(required)
    ? ALLOWED
    : { allowed: false, reason: 'UPGRADE_REQUIRED', requiredTier: minTier };
}

/* ── Course helpers ──────────────────────────────────────────── */

interface CourseLike {
  id?: string;
  minTier?: number | null;
  priceType?: string | null;
  freePreviewCount?: number | null;
  price?: number | null;
  kind?: string | null;
  level?: string | null;
}

/** A course's minTier, derived from its level when not explicitly set. */
export function courseMinTier(course: CourseLike): AccessTier {
  if (typeof course.minTier === 'number') return Math.min(6, Math.max(0, course.minTier)) as AccessTier;
  const named = programmeByValue(canonicalProgramme(course.level));
  // Degree programmes are tier 4 in the taxonomy and sold inside Professional
  // & Degrees, which grants access tier 3.
  if (named) return (named.tier >= 4 ? 3 : named.tier) as AccessTier;
  const level = (course.level ?? '').toLowerCase();
  if (level.includes('primary')) return 1;
  if (level.includes('secondary')) return 1;
  if (level.includes('gcse') || level.includes('a-level') || level.includes('a level')) return 2;
  if (level.includes('university') || level.includes('degree')) return 3;
  // Marketplace courses only require an account.
  return course.kind === 'curriculum' ? 2 : 6;
}

/** A course's priceType, derived from its price when not explicitly set. */
export function coursePriceType(course: CourseLike): PriceType {
  if (course.priceType && course.priceType in PRICE_TYPE_LABELS) return course.priceType as PriceType;
  if (course.kind === 'curriculum') return 'SUBSCRIPTION_INCLUDED';
  return (course.price ?? 0) > 0 ? 'MARKETPLACE_PURCHASE' : 'FREE';
}

/** How many opening lessons are free to everyone. */
export function freePreviewCount(course: CourseLike): number {
  if (typeof course.freePreviewCount === 'number') return Math.max(0, Math.min(3, course.freePreviewCount));
  const priceType = coursePriceType(course);
  if (priceType === 'FREE') return Number.MAX_SAFE_INTEGER;
  return DEFAULT_FREE_PREVIEW_COUNT;
}

/** Is this lesson inside the free preview window? `index` is zero-based. */
export function isLessonFree(course: CourseLike, index: number): boolean {
  return index < freePreviewCount(course);
}
