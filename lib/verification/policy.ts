/**
 * Verification tiers. The server is the only writer.
 * A missing record is tier 0.
 */

export const VERIFICATION_TIERS = [0, 1, 2, 3, 4] as const;
export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

export const VERIFICATION_METHODS = [
  'basic',
  'otp',
  'guardian_link',
  'id_check',
  'admin_invite',
  'email_domain',
  'school_documents',
  'partner_review',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export interface VerificationRecord {
  tier: VerificationTier;
  method: VerificationMethod;
  verifiedAt: number;
  verifiedBy: string;
}

export type GatedFeature = 'network' | 'dm' | 'parent_alert' | 'staff_case' | 'amber';

const TIER_NEED: Record<GatedFeature, number> = {
  network: 1,
  dm: 1,
  parent_alert: 2,
  staff_case: 3,
  amber: 3,
};

const LABELS = ['Basic', 'Contact verified', 'Verified guardian', 'Verified staff', 'Verified partner'] as const;

export function emptyVerification(): VerificationRecord {
  return { tier: 0, method: 'basic', verifiedAt: 0, verifiedBy: '' };
}

export function isVerificationTier(value: number): value is VerificationTier {
  return VERIFICATION_TIERS.includes(value as VerificationTier);
}

export function isVerificationMethod(value: string): value is VerificationMethod {
  return (VERIFICATION_METHODS as readonly string[]).includes(value);
}

export function readVerification(value: unknown): VerificationRecord {
  if (!value || typeof value !== 'object') return emptyVerification();
  const row = value as { tier?: unknown; method?: unknown; verifiedAt?: unknown; verifiedBy?: unknown };
  const tier = typeof row.tier === 'number' && isVerificationTier(row.tier) ? row.tier : 0;
  const method = typeof row.method === 'string' && isVerificationMethod(row.method) ? row.method : 'basic';
  return {
    tier,
    method: tier === 0 ? 'basic' : method,
    verifiedAt: typeof row.verifiedAt === 'number' ? row.verifiedAt : 0,
    verifiedBy: typeof row.verifiedBy === 'string' ? row.verifiedBy : '',
  };
}

/** True when the account already meets the tier. */
export function requireTier(have: number, need: number): boolean {
  return Number.isFinite(have) && have >= need;
}

export function featureTier(feature: GatedFeature): number {
  return TIER_NEED[feature];
}

export function tierLabel(tier: number): string {
  return LABELS[tier] ?? LABELS[0];
}

/** A higher tier is kept. A later write cannot drop someone back to basic. */
export function raiseVerification(current: VerificationRecord, next: VerificationRecord): VerificationRecord {
  if (next.tier < current.tier) return current;
  return next;
}

export function networkAllowed(tier: number): boolean {
  return requireTier(tier, featureTier('network'));
}

export function parentAlertAllowed(tier: number): boolean {
  return requireTier(tier, featureTier('parent_alert'));
}

/** Super admin keeps platform access. Everyone else needs tier 3. */
export function staffCaseAllowed(role: string, tier: number): boolean {
  if (role === 'admin') return true;
  return requireTier(tier, featureTier('staff_case'));
}

/**
 * Amber (missing child) is a tier 3 principal or a tier 4 partner.
 * Anyone without a school, who is not a super admin and not a partner, cannot publish any alert.
 */
export function publishBlock(input: {
  tier: number;
  role: string;
  staffPost: string;
  institutionId: string;
  type: string;
}): string | null {
  const individual = !input.institutionId && input.role !== 'admin' && input.tier < 4;
  if (individual) {
    return 'Individuals submit to the Poket School Safety Desk. They cannot publish an alert.';
  }
  if (input.type === 'missing_child') {
    const principal = requireTier(input.tier, 3) && input.staffPost === 'principal';
    const partner = requireTier(input.tier, 4);
    if (!principal && !partner) {
      return 'An Amber alert is published by a tier 3 principal or a tier 4 partner.';
    }
  }
  return null;
}

export function emailDomainMatches(email: string, domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/^@/, '');
  const at = email.trim().toLowerCase().split('@')[1] ?? '';
  return host.length > 2 && at === host;
}
