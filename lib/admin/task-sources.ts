/**
 * Maps existing queues onto `admin_tasks`.
 * Summaries stay generic. Names, emails, and phone numbers are not copied here.
 * `buildAdminTask` runs `safeSummary` again before the write.
 */
import { SENSITIVE_CATEGORIES } from '@/lib/hotline/policy';
import type { AdminTaskPriority, AdminTaskType } from '@/lib/admin/tasks';

export interface TaskDraft {
  type: AdminTaskType;
  entityType: string;
  entityPath: string;
  title: string;
  summary: string;
  priority: AdminTaskPriority;
  slaTier?: AdminTaskPriority;
  scope?: { institutionId?: string; region?: string };
}

/** Sources the cron and the server writers keep in sync. Blog drafts are not a review queue. */
export const ADMIN_TASK_SOURCE_NOTES = [
  { source: 'institutions/{id}/join_requests/{uid}', type: 'registration or teacher_verification', when: 'status is pending' },
  { source: 'hotline_tickets/{id}', type: 'safeline_case', when: 'status is pending, in_progress, or kiv' },
  { source: 'emergency_alerts/{id}', type: 'amber_request', when: 'missing child and not resolved or retracted' },
  { source: 'reports/{id}', type: 'report', when: 'status is open' },
  { source: 'moderation_appeals/{id}', type: 'report', when: 'status is open' },
  { source: 'moderation_queue/{id}', type: 'report', when: 'not a copy of a report, and not approved or rejected' },
  { source: 'institutions/{id}', type: 'institution_verification', when: 'status is pending' },
  { source: 'communityPartnerApplications/{id}', type: 'partner_application', when: 'status is pending' },
  { source: 'partners/{id}', type: 'partner_application', when: 'status is pending' },
  { source: 'offers/{id}', type: 'other', when: 'status is review' },
  { source: 'courses/{id}', type: 'course_review', when: 'status is pending_approval' },
  { source: 'refund_requests/{id}', type: 'other', when: 'status is requested' },
  { source: 'payouts/{id}', type: 'other', when: 'status is transfer_failed or awaiting_connect' },
  { source: 'support_tickets/{id}', type: 'other', when: 'status is open or in_progress' },
  { source: 'institutions/{id}/billing/current', type: 'other', when: 'phase is grace or suspended' },
  { source: 'subscriber_billing/{uid}', type: 'other', when: 'phase is grace or suspended' },
] as const;

const SENSITIVE = new Set<string>(SENSITIVE_CATEGORIES);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function scopeOf(data: Record<string, unknown>, institutionId = ''): TaskDraft['scope'] {
  const scope: { institutionId?: string; region?: string } = {};
  const school = institutionId || text(data.institutionId);
  const region = text(data.region) || text(data.state);
  if (school) scope.institutionId = school;
  if (region) scope.region = region;
  return scope;
}

function hotlinePriority(data: Record<string, unknown>): AdminTaskPriority {
  const priority = text(data.priority);
  const tier: AdminTaskPriority = priority === 'high' || priority === 'critical'
    ? 'high'
    : priority === 'low'
      ? 'low'
      : 'medium';
  if (SENSITIVE.has(text(data.category)) && (priority === 'high' || priority === 'critical')) return 'critical';
  return tier;
}

/** A teacher or institution staff join is a teacher application. A student join is a registration. */
export function joinTaskType(role: string): 'registration' | 'teacher_verification' {
  return role === 'teacher' || role === 'institution_admin' ? 'teacher_verification' : 'registration';
}

export function draftForDocument(path: string, data: Record<string, unknown>): TaskDraft | null {
  const join = /^institutions\/([^/]+)\/join_requests\/([^/]+)$/.exec(path);
  if (join) {
    if (text(data.status) !== 'pending') return null;
    const type = joinTaskType(text(data.role));
    return {
      type,
      entityType: 'join_requests',
      entityPath: path,
      title: type === 'teacher_verification' ? 'Teacher application' : 'Student registration',
      summary: type === 'teacher_verification'
        ? 'A teacher asked to join a school. Review and assign a class from the people page.'
        : 'A student registration is waiting. Review, approve, or assign a class.',
      priority: 'high',
      scope: { institutionId: join[1] },
    };
  }

  const bill = /^institutions\/([^/]+)\/billing\/current$/.exec(path);
  if (bill) {
    const phase = text(data.phase);
    if (phase !== 'grace' && phase !== 'suspended') return null;
    return {
      type: 'other',
      entityType: 'billing',
      entityPath: path,
      title: 'Failed payment',
      summary: 'A school payment needs attention.',
      priority: 'high',
      scope: { institutionId: bill[1] },
    };
  }

  const head = path.split('/')[0] ?? '';
  const id = path.split('/')[1] ?? '';
  if (!id || path.split('/').length !== 2) return null;

  if (head === 'hotline_tickets') {
    const status = text(data.status);
    if (status === 'solved' || status === 'closed') return null;
    const tier = hotlinePriority(data);
    const category = text(data.category).replace(/_/g, ' ') || 'ticket';
    return {
      type: 'safeline_case',
      entityType: 'hotline_tickets',
      entityPath: path,
      title: 'SafeLine case',
      summary: `SafeLine ${category} ticket`,
      priority: tier,
      slaTier: tier,
      scope: scopeOf(data),
    };
  }

  if (head === 'emergency_alerts') {
    if (text(data.type) !== 'missing_child') return null;
    if (data.resolved != null || text(data.retractedReason) || text(data.status) === 'retracted') return null;
    return {
      type: 'amber_request',
      entityType: 'emergency_alerts',
      entityPath: path,
      title: 'Amber request',
      summary: 'An amber request is waiting for review.',
      priority: 'high',
      scope: scopeOf(data),
    };
  }

  if (head === 'reports') {
    if (text(data.status) !== 'open') return null;
    return {
      type: 'report',
      entityType: 'reports',
      entityPath: path,
      title: 'Reported content',
      summary: 'A community report is waiting.',
      priority: 'medium',
      scope: scopeOf(data),
    };
  }

  if (head === 'moderation_appeals') {
    if (text(data.status) !== 'open') return null;
    return {
      type: 'report',
      entityType: 'moderation_appeals',
      entityPath: path,
      title: 'Moderation appeal',
      summary: 'A moderation appeal is waiting.',
      priority: 'medium',
    };
  }

  if (head === 'moderation_queue') {
    if (text(data.surface) === 'report') return null;
    const status = text(data.status);
    if (status === 'approved' || status === 'rejected') return null;
    return {
      type: 'report',
      entityType: 'moderation_queue',
      entityPath: path,
      title: 'Reported content',
      summary: 'Reported content is waiting for review.',
      priority: 'medium',
    };
  }

  if (head === 'institutions') {
    if (text(data.status) !== 'pending') return null;
    const name = text(data.name) || 'Institution';
    return {
      type: 'institution_verification',
      entityType: 'institutions',
      entityPath: path,
      title: name,
      summary: `Institution approval is waiting for ${name}`,
      priority: 'medium',
      scope: text(data.state) ? { region: text(data.state) } : {},
    };
  }

  if (head === 'communityPartnerApplications') {
    if (text(data.status) !== 'pending') return null;
    return {
      type: 'partner_application',
      entityType: head,
      entityPath: path,
      title: text(data.orgName) || 'Community partner',
      summary: 'A community partner application is waiting.',
      priority: 'medium',
      scope: text(data.region) ? { region: text(data.region) } : {},
    };
  }

  if (head === 'partners') {
    if (text(data.status) !== 'pending') return null;
    return {
      type: 'partner_application',
      entityType: 'partners',
      entityPath: path,
      title: text(data.name) || 'Merchant',
      summary: 'A merchant application is waiting.',
      priority: 'medium',
      scope: scopeOf(data),
    };
  }

  if (head === 'offers') {
    if (text(data.status) !== 'review') return null;
    return {
      type: 'other',
      entityType: 'offers',
      entityPath: path,
      title: text(data.title) || 'Offer',
      summary: 'An offer is waiting for review.',
      priority: 'low',
      scope: scopeOf(data),
    };
  }

  if (head === 'courses') {
    if (text(data.status) !== 'pending_approval') return null;
    return {
      type: 'course_review',
      entityType: 'courses',
      entityPath: path,
      title: text(data.title) || 'Course review',
      summary: 'A course is waiting for review.',
      priority: 'medium',
      scope: scopeOf(data),
    };
  }

  if (head === 'refund_requests') {
    if (text(data.status) !== 'requested') return null;
    return {
      type: 'other',
      entityType: 'refund_requests',
      entityPath: path,
      title: 'Refund request',
      summary: 'A refund is waiting for the gateway.',
      priority: 'high',
    };
  }

  if (head === 'payouts') {
    const status = text(data.status);
    if (status !== 'transfer_failed' && status !== 'awaiting_connect') return null;
    const failed = status === 'transfer_failed';
    return {
      type: 'other',
      entityType: 'payouts',
      entityPath: path,
      title: failed ? 'Payout failed' : 'Payout waiting',
      summary: failed ? 'A payout transfer failed.' : 'A payout is waiting for a connected account.',
      priority: failed ? 'high' : 'medium',
    };
  }

  if (head === 'support_tickets') {
    const status = text(data.status);
    if (status !== 'open' && status !== 'in_progress') return null;
    const urgent = text(data.priority) === 'urgent' || text(data.priority) === 'high';
    return {
      type: 'other',
      entityType: 'support_tickets',
      entityPath: path,
      title: 'Support ticket',
      summary: 'A support ticket is open.',
      priority: urgent ? 'high' : 'medium',
    };
  }

  if (head === 'subscriber_billing') {
    const phase = text(data.phase);
    if (phase !== 'grace' && phase !== 'suspended') return null;
    return {
      type: 'other',
      entityType: 'subscriber_billing',
      entityPath: path,
      title: 'Failed payment',
      summary: 'A subscription payment needs attention.',
      priority: 'high',
    };
  }

  return null;
}

/** True when the source document no longer needs an admin. A missing document is not resolved. */
export function sourceResolved(entityType: string, data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  return draftForDocument(samplePath(entityType), data) === null && knownEntity(entityType);
}

function knownEntity(entityType: string): boolean {
  return [
    'join_requests',
    'hotline_tickets',
    'emergency_alerts',
    'reports',
    'moderation_appeals',
    'moderation_queue',
    'institutions',
    'communityPartnerApplications',
    'partners',
    'offers',
    'courses',
    'refund_requests',
    'payouts',
    'support_tickets',
    'billing',
    'subscriber_billing',
  ].includes(entityType);
}

function samplePath(entityType: string): string {
  if (entityType === 'join_requests') return 'institutions/school/join_requests/uid';
  if (entityType === 'billing') return 'institutions/school/billing/current';
  return `${entityType}/id`;
}
