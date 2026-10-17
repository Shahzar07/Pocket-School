/**
 * Shared alert shape for Poket School.
 *
 * Safeguarding on the network branch should import this module and set
 * `type: 'safety'`. Learning progress uses `type: 'progress'`. Do not fork
 * a second severity enum.
 */

export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** `safety` is safeguarding. `progress` is learning early-warning. */
export const ALERT_TYPES = ['safety', 'progress'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_STATUSES = ['open', 'acknowledged', 'assigned', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface AlertNote {
  at: number;
  authorId: string;
  authorName: string;
  text: string;
}

export interface AlertAuditEntry {
  at: number;
  actorId: string;
  action:
    | 'opened'
    | 'acknowledged'
    | 'assigned'
    | 'note'
    | 'resolved'
    | 'auto_resolved'
    | 'notified'
    | 'acted'
    | 'parent_seen'
    | 'parent_acted'
    | 'escalated'
    | 'delegated'
    | 'check_in'
    | 'meeting';
  detail: string;
}

/**
 * Ownership, due time, checklist, and escalation. Safeguarding alerts on
 * the network branch should store this same object.
 */
export interface SharedAccountabilityRef {
  ownerId: string | null;
  coOwnerId: string | null;
  delegateId: string | null;
  dueAt: number | null;
  acknowledgedAt: number | null;
  actedAt: number | null;
}

/** Fields both safety and progress alerts store. */
export interface SharedAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  studentId: string;
  institutionId: string | null;
  title: string;
  summary: string;
  safeguardingCaseId: string | null;
  assigneeId: string | null;
  notes: AlertNote[];
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  autoResolved: boolean;
  audit: AlertAuditEntry[];
  /** Null on a low alert that has no owner yet. Safety alerts use the same shape. */
  accountability: SharedAccountabilityRef | null;
}

export function severityRank(severity: AlertSeverity): number {
  return ALERT_SEVERITIES.indexOf(severity);
}

export function maxSeverity(values: readonly AlertSeverity[]): AlertSeverity | null {
  let best: AlertSeverity | null = null;
  for (const value of values) {
    if (!best || severityRank(value) > severityRank(best)) best = value;
  }
  return best;
}

export function severityAtLeast(value: AlertSeverity, minimum: AlertSeverity): boolean {
  return severityRank(value) >= severityRank(minimum);
}

export function isAlertSeverity(value: string): value is AlertSeverity {
  return (ALERT_SEVERITIES as readonly string[]).includes(value);
}

export function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value);
}
