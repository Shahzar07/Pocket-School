/**
 * Automation defaults. Founders and recruiter billing stay off until a super admin enables them.
 * Student groups start on, and the school approves them.
 */

export interface NetworkAutomation {
  networkOn: boolean;
  recruiterTierOn: boolean;
  foundersOn: boolean;
  foundersProOn: boolean;
  studentGroupsOn: boolean;
  groupApprovalMode: 'school' | 'auto';
  groupDuesOn: boolean;
  orgVerificationMode: 'domain_and_admin' | 'admin_only';
  recruiterFreeCents: number;
  recruiterProCents: number;
  foundersProCents: number;
  inmailCreditsFree: number;
  inmailCreditsPro: number;
}

export const DEFAULT_AUTOMATION: NetworkAutomation = {
  networkOn: true,
  recruiterTierOn: false,
  foundersOn: false,
  foundersProOn: false,
  studentGroupsOn: true,
  groupApprovalMode: 'school',
  groupDuesOn: false,
  orgVerificationMode: 'domain_and_admin',
  recruiterFreeCents: 0,
  recruiterProCents: 0,
  foundersProCents: 0,
  inmailCreditsFree: 0,
  inmailCreditsPro: 20,
};

export function readAutomation(raw: unknown): NetworkAutomation {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const mode = source.groupApprovalMode === 'auto' ? 'auto' : 'school';
  const verify = source.orgVerificationMode === 'admin_only' ? 'admin_only' : 'domain_and_admin';
  const cents = (key: keyof NetworkAutomation, fallback: number) => {
    const value = source[key];
    return typeof value === 'number' && value >= 0 && value < 1_000_000 ? Math.round(value) : fallback;
  };
  return {
    networkOn: source.networkOn !== false,
    recruiterTierOn: source.recruiterTierOn === true,
    foundersOn: source.foundersOn === true,
    foundersProOn: source.foundersProOn === true,
    studentGroupsOn: source.studentGroupsOn !== false,
    groupApprovalMode: mode,
    groupDuesOn: source.groupDuesOn === true,
    orgVerificationMode: verify,
    recruiterFreeCents: cents('recruiterFreeCents', 0),
    recruiterProCents: cents('recruiterProCents', 0),
    foundersProCents: cents('foundersProCents', 0),
    inmailCreditsFree: cents('inmailCreditsFree', 0),
    inmailCreditsPro: cents('inmailCreditsPro', 20),
  };
}
