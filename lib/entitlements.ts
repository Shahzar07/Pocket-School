/**
 * Access tiers, content types and entitlement checking.
 *
 * Implements the model in the Entitlements Brief and the Product & Course
 * Pricing Addendum (August 2026). Two gates run in sequence for every piece of
 * content:
 *
 *   Gate 1 — access tier:  tierCovers(userTier, content.minTier)
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
  /** Monthly price in USD. 0 = free, null = not sold directly (institution/marketplace). */
  usd: number | null;
  /** Monthly price in MYR. */
  myr: number | null;
  /** Monthly Sparks allowance. */
  sparks: number;
  /** Sparks that roll over into the next month. */
  sparksRollover: number;
  programmes: string[];
}

/**
 * Commercial plans from the October 2026 master brief. One USD price worldwide.
 * `myr` stays on the type for older documents and is not shown.
 *
 * Sparks allowances stay on the access-tier table (300 / 800 / 2,000 / 2,000 /
 * 10,000). The $19 plan is tier 3 and still receives 2,000 Sparks — see
 * docs/SPARKS.md. It does not unlock tier 1 or tier 2 courses. Tier 4 ($99)
 * includes tiers 0–4. Ids `professional` and `llb` are kept so existing Stripe
 * metadata still maps.
 */
export const TIERS: TierDefinition[] = [
  {
    tier: 0, id: 'preview', name: 'Free Preview', usd: 0, myr: null,
    blurb: 'Browse the catalogue and open the first lesson of any course.',
    sparks: 0, sparksRollover: 0,
    programmes: ['Course catalogue', 'First lesson of any course', 'Certificate verification'],
  },
  {
    tier: 1, id: 'primary_secondary', name: 'Primary & Lower Secondary', usd: 49, myr: null,
    blurb: 'Primary and Lower Secondary on one plan.',
    sparks: 300, sparksRollover: 100,
    programmes: ['Primary', 'Lower Secondary', 'ET AI teachers', 'ET AI Studio'],
  },
  {
    tier: 2, id: 'igcse_alevel', name: 'IGCSE & A-Level', usd: 79, myr: null,
    blurb: 'IGCSE and A-Level. Primary and Lower Secondary are included.',
    sparks: 800, sparksRollover: 300,
    programmes: ['IGCSE', 'A-Level', 'Primary and Lower Secondary included', 'ET Maths and Exam Prep', 'Parent dashboard'],
  },
  {
    tier: 3, id: 'professional', name: 'Micro Degree & Professional', usd: 19, myr: null,
    blurb: 'Short courses and independent study. IGCSE and A-Level are a separate plan.',
    sparks: 2000, sparksRollover: 700,
    programmes: ['Micro Degree', 'Professional Certification', 'Independent Learning', 'Self-paced'],
  },
  {
    tier: 4, id: 'llb', name: 'LLB Law & MBBS Medicine', usd: 99, myr: null,
    blurb: 'Degree programmes. The IGCSE and A-Level plan is included.',
    sparks: 2000, sparksRollover: 700,
    programmes: ['LLB Law — 12 modules', 'MBBS Medicine', 'ET Law and ET Medicine', 'IGCSE and A-Level included'],
  },
  {
    tier: 5, id: 'institution', name: 'Institution', usd: null, myr: null,
    blurb: 'Custom pricing for schools, colleges and training centres.',
    sparks: 10000, sparksRollover: 0,
    programmes: ['All programmes', 'Teacher tools', 'Institution admin', 'Shared Sparks pool', 'White-label'],
  },
  {
    tier: 6, id: 'marketplace', name: 'Marketplace', usd: null, myr: null,
    blurb: 'Buy a single course outright. No subscription required.',
    sparks: 0, sparksRollover: 0,
    programmes: ['Any individual course', 'Permanent access after purchase'],
  },
];

export function tierDefinition(tier: AccessTier): TierDefinition {
  return TIERS.find(t => t.tier === tier) ?? TIERS[0];
}

/**
 * Whether a subscriber's plan includes content tagged with `contentTier`.
 *
 * Tier 3 is the $19 short-course plan and covers only tier 3 content.
 * A numeric `userTier >= contentTier` check would let that plan open IGCSE.
 * Tier 4 ($99) covers tiers 0–4. Tier 5 covers every tier. Tier 6 is a
 * single-course purchase and does not include a subscription library.
 */
export function tierCovers(userTier: number, contentTier: number): boolean {
  if (contentTier <= 0) return true;
  if (userTier === 5) return true;
  if (userTier === 4) return contentTier <= 4;
  if (userTier === 3) return contentTier === 3;
  if (userTier === 2) return contentTier === 1 || contentTier === 2;
  if (userTier === 1) return contentTier === 1;
  return false;
}

/** Annual billing discount from the brief. */
export const ANNUAL_DISCOUNT = 0.25;

/* ── Content types ───────────────────────────────────────────── */

export type ContentType =
  | 'FREE_PREVIEW' | 'MARKETPLACE_BROWSE'
  | 'ET_AI_STUDIO'
  | 'COURSE_PRIMARY' | 'COURSE_SECONDARY' | 'COURSE_IGCSE' | 'COURSE_ALEVEL'
  | 'COURSE_PRE_UNIVERSITY' | 'COURSE_LLB' | 'COURSE_MICRO_DEGREE'
  | 'COURSE_PROFESSIONAL_CERT' | 'COURSE_INDEPENDENT'
  | 'AI_TUTOR_SESSION' | 'AI_TUTOR_LAW' | 'LYRA_LIVE'
  | 'BLOOM_TRACKING' | 'GOALS_LINKED' | 'PARENT_DASHBOARD' | 'CERTIFICATE'
  | 'MARKETPLACE_PURCHASE' | 'MARKETPLACE_LIST'
  | 'GRADEBOOK' | 'ATTENDANCE' | 'EXAM_BUILDER' | 'REPORT_CARD' | 'LIVE_CLASS'
  | 'INTEGRITY_MONITOR' | 'BEHAVIOUR_LOG'
  | 'INSTITUTION_ADMIN' | 'PLATFORM_ADMIN';

/** contentType → the permission string that satisfies it. */
export const PLAN_MAP: Record<string, string> = {
  COURSE_PRIMARY: 'plan:primary',
  COURSE_SECONDARY: 'plan:secondary',
  COURSE_IGCSE: 'plan:igcse',
  COURSE_ALEVEL: 'plan:alevel',
  COURSE_PRE_UNIVERSITY: 'plan:pre_university',
  COURSE_LLB: 'plan:llb',
  COURSE_MICRO_DEGREE: 'plan:micro_degree',
  COURSE_PROFESSIONAL_CERT: 'plan:professional_cert',
  COURSE_INDEPENDENT: 'plan:independent',
  ET_AI_STUDIO: 'et_ai:studio',
  AI_TUTOR_SESSION: 'plan:ai_tutor',
  AI_TUTOR_LAW: 'plan:llb',
  LYRA_LIVE: 'addon:lyra_live',
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
  COURSE_IGCSE: 2, COURSE_ALEVEL: 2, COURSE_PRE_UNIVERSITY: 2, COURSE_INDEPENDENT: 3,
  ET_AI_STUDIO: 1, AI_TUTOR_SESSION: 2, BLOOM_TRACKING: 2, GOALS_LINKED: 2,
  PARENT_DASHBOARD: 2, CERTIFICATE: 2, LYRA_LIVE: 2,
  COURSE_MICRO_DEGREE: 3, COURSE_PROFESSIONAL_CERT: 3,
  COURSE_LLB: 4, AI_TUTOR_LAW: 4,
  GRADEBOOK: 5, ATTENDANCE: 5, EXAM_BUILDER: 5, REPORT_CARD: 5, LIVE_CLASS: 5,
  INTEGRITY_MONITOR: 5, BEHAVIOUR_LOG: 5, INSTITUTION_ADMIN: 5, MARKETPLACE_LIST: 5,
  MARKETPLACE_PURCHASE: 6,
  PLATFORM_ADMIN: 5,
};

/* ── Price types ─────────────────────────────────────────────── */

export type PriceType =
  | 'FREE'
  | 'FREE_PREVIEW'
  | 'SUBSCRIPTION_INCLUDED'
  | 'MARKETPLACE_PURCHASE'
  | 'INSTITUTION_ALLOCATED'
  | 'COUPON_SCHOLARSHIP';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  FREE: 'Free',
  FREE_PREVIEW: 'Free preview, then paid',
  SUBSCRIPTION_INCLUDED: 'Included in subscription',
  MARKETPLACE_PURCHASE: 'One-time purchase',
  INSTITUTION_ALLOCATED: 'Allocated by institution',
  COUPON_SCHOLARSHIP: 'Coupon / scholarship',
};

/** Default number of free lessons at the start of a paid course. */
export const DEFAULT_FREE_PREVIEW_COUNT = 1;

/* ── Permission strings ──────────────────────────────────────── */

export const allocFree = (courseId: string) => `alloc:free:${courseId}`;
export const allocPaid = (courseId: string) => `alloc:paid:${courseId}`;
export const allocMarketplace = (courseId: string) => `alloc:marketplace:${courseId}`;
export const allocCoupon = (courseId: string, expiry: string) => `alloc:coupon:${courseId}:${expiry}`;
export const allocInstitution = (instId: string, courseId: string) =>
  `alloc:institution:${instId}:${courseId}`;

/* ── Add-ons ─────────────────────────────────────────────────── */

export interface AddOn {
  id: string;
  permission: string;
  name: string;
  blurb: string;
  usdMonthly: number;
  myrMonthly: number;
  /** Base tier required before the add-on can be bought. */
  requiresTier: AccessTier;
}

/**
 * Add-ons are bought on top of a qualifying plan and are independent of it —
 * cancelling the add-on leaves the plan intact, and vice versa.
 */
export const ADDONS: AddOn[] = [
  {
    id: 'lyra_live',
    permission: 'addon:lyra_live',
    name: 'Lyra Live',
    blurb: 'Real-time face-to-face sessions with an AI teacher who sees and hears you.',
    usdMonthly: 49,
    myrMonthly: 219,
    requiresTier: 2,
  },
];

export function addOn(id: string): AddOn | undefined {
  return ADDONS.find(a => a.id === id);
}

/** Does this permission set include a given add-on? Super admins always do. */
export function hasAddOn(permissions: string[], id: string): boolean {
  if (permissions.includes('role:super_admin')) return true;
  const a = addOn(id);
  return !!a && permissions.includes(a.permission);
}

/**
 * Permissions implied by an access tier.
 * Tier 3 does not inherit school or exam plans. Tier 4 includes those plans.
 * Tier 6 is marketplace only.
 */
export function permissionsForTier(tier: AccessTier): string[] {
  const base = ['free:preview', 'plan:marketplace_purchase'];
  const studio = ['et_ai:studio', 'plan:ai_tutor'];
  const school = ['plan:primary', 'plan:secondary'];
  const exam = [
    'plan:igcse', 'plan:alevel', 'plan:pre_university',
    'plan:bloom_tracking', 'plan:goals_linked', 'plan:parent_dashboard', 'plan:certificate',
  ];
  const shortForm = ['plan:micro_degree', 'plan:professional_cert', 'plan:independent'];
  if (tier === 1) return [...base, ...studio, ...school];
  if (tier === 2) return [...base, ...studio, ...school, ...exam];
  if (tier === 3) return [...base, ...studio, ...shortForm];
  if (tier === 4 || tier === 5) return [...base, ...studio, ...school, ...exam, ...shortForm, 'plan:llb'];
  return base;
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
  // Older accounts stored a binary plan. 'academic' was the exam-years plan.
  // Anyone else is on the free preview until a plan is set.
  return profile.subscriptionTier === 'academic' ? 2 : 0;
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
    if (perms.includes(allocMarketplace(courseId))) return ALLOWED;
    if (perms.some(p => p.startsWith(`alloc:coupon:${courseId}:`) && couponLive(p))) return ALLOWED;

    const institutionRe = new RegExp(`^alloc:institution:[^:]+:${courseId}$`);
    if (perms.some(p => institutionRe.test(p))) return ALLOWED;

    // alloc:paid activates the route but the plan gate below still applies.
    paidAllocation = perms.includes(allocPaid(courseId));
  }

  // Gate 1 — access tier. Studio tools are open to every paid plan, including
  // the $19 short-course plan, which does not include school curricula.
  const studioTool = contentType === 'ET_AI_STUDIO' || contentType === 'AI_TUTOR_SESSION';
  const tierOk = studioTool ? userTier >= 1 : tierCovers(userTier, minTier);
  if (!tierOk) {
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
  const level = (course.level ?? '').toLowerCase();
  if (level.includes('micro') || level.includes('professional') || level.includes('independent')) return 3;
  if (level.includes('llb') || level.includes('mbbs') || level.includes('medicine')) return 4;
  if (level.includes('igcse') || level.includes('a-level') || level.includes('a level')) return 2;
  if (level.includes('primary') || level.includes('secondary')) return 1;
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
