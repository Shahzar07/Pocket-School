/**
 * Whether a ticket or an alert needs the authorities.
 * `no` needs a reason. Public sharing waits until the status is informed or later.
 */

export const AUTHORITY_REQUIRED = ['yes', 'no', 'unsure'] as const;
export type AuthorityRequired = (typeof AUTHORITY_REQUIRED)[number];

export const AUTHORITY_STATUSES = [
  'not_required',
  'to_be_informed',
  'informed',
  'acknowledged',
  'closed_by_authority',
] as const;
export type AuthorityStatus = (typeof AUTHORITY_STATUSES)[number];

export const TICKET_AUTHORITY_REMINDER_MS = 4 * 60 * 60 * 1000;
export const ALERT_AUTHORITY_REMINDER_MS = 60 * 60 * 1000;

export interface AuthorityNotice {
  agency: string;
  contact: string;
  reference: string;
  at: number;
  by: string;
}

export interface AuthorityDecision {
  required: AuthorityRequired;
  reason: string;
  status: AuthorityStatus;
  informed: AuthorityNotice | null;
}

export function isAuthorityRequired(value: string): value is AuthorityRequired {
  return (AUTHORITY_REQUIRED as readonly string[]).includes(value);
}

export function isAuthorityStatus(value: string): value is AuthorityStatus {
  return (AUTHORITY_STATUSES as readonly string[]).includes(value);
}

export function initialAuthorities(required: string, reason: string): { decision: AuthorityDecision } | { error: string } {
  if (required === 'no') {
    if (reason.trim().length < 3) return { error: 'A reason is required when authorities are not needed.' };
    return { decision: { required: 'no', reason: reason.trim(), status: 'not_required', informed: null } };
  }
  if (required !== 'yes' && required !== 'unsure') return { error: 'Choose whether authorities are required.' };
  return {
    decision: {
      required,
      reason: '',
      status: 'to_be_informed',
      informed: null,
    },
  };
}

export function authorityShareReady(status: string): boolean {
  return status === 'informed' || status === 'acknowledged' || status === 'closed_by_authority';
}

/** A ticket stays open while the school still has to inform the authorities. */
export function canCloseTicket(status: string): boolean {
  return status !== 'to_be_informed';
}

export function authorityOverdue(createdAt: number, status: string, now: number, limitMs: number, remindedAt: number): boolean {
  if (status !== 'to_be_informed' || remindedAt > 0) return false;
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return now - createdAt >= limitMs;
}

export function applyAuthorityUpdate(current: AuthorityDecision, input: {
  status: string;
  reason: string;
  agency: string;
  contact: string;
  reference: string;
  by: string;
  at: number;
}): { decision: AuthorityDecision } | { error: string } {
  if (!isAuthorityStatus(input.status)) return { error: 'Choose an authority status.' };
  if (input.status === 'not_required') {
    const reason = input.reason.trim() || current.reason.trim();
    if (reason.length < 3) return { error: 'A reason is required when authorities are not needed.' };
    return { decision: { required: 'no', reason, status: 'not_required', informed: current.informed } };
  }
  if (input.status === 'to_be_informed') {
    return { decision: { required: current.required === 'no' ? 'unsure' : current.required, reason: '', status: 'to_be_informed', informed: current.informed } };
  }
  if (input.status === 'informed') {
    if (input.agency.trim().length < 2 || input.contact.trim().length < 3 || input.reference.trim().length < 2) {
      return { error: 'Record the agency, a contact, and a reference.' };
    }
    return {
      decision: {
        required: 'yes',
        reason: '',
        status: 'informed',
        informed: {
          agency: input.agency.trim(),
          contact: input.contact.trim(),
          reference: input.reference.trim(),
          at: input.at,
          by: input.by,
        },
      },
    };
  }
  if (!authorityShareReady(current.status)) {
    return { error: 'Inform the authorities before this status.' };
  }
  return { decision: { ...current, status: input.status } };
}
