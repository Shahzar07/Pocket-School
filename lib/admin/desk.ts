/**
 * Admin desk policy. Super admins see the whole platform.
 * An admin is limited to one institution or region and cannot read a
 * safeguarding identity unless they are also the safeguarding lead.
 */

export const BROADCAST_CONFIRM = 'SEND';

export const BROADCAST_CATEGORIES = ['general', 'safety', 'emergency', 'learning', 'payments'] as const;

export const DESK_QUEUES = [
  { id: 'verification', label: 'Verification', href: '/dashboard/admin/queues#verification' },
  { id: 'merchants', label: 'Partner merchants', href: '/dashboard/admin/queues#merchants' },
  { id: 'community', label: 'Community partners', href: '/dashboard/admin/queues#community' },
  { id: 'offers', label: 'Offers', href: '/dashboard/admin/queues#offers' },
  { id: 'moderation', label: 'Moderation', href: '/dashboard/admin/queues#moderation' },
  { id: 'appeals', label: 'Appeals', href: '/dashboard/admin/queues#appeals' },
  { id: 'safety', label: 'Safety Desk', href: '/dashboard/admin/queues#safety' },
  { id: 'schools', label: 'School notices', href: '/dashboard/admin/queues#schools' },
  { id: 'authorities', label: 'Authority referrals', href: '/dashboard/admin/queues#authorities' },
  { id: 'amber', label: 'Amber approvals', href: '/dashboard/admin/queues#amber' },
  { id: 'institutions', label: 'Institution approvals', href: '/dashboard/admin/queues#institutions' },
] as const;

export type DeskQueueId = (typeof DESK_QUEUES)[number]['id'];

export interface DeskActor {
  uid: string;
  role: string;
  staffRole: 'super_admin' | 'admin' | null;
  institutionId: string;
  region: string;
  country: string;
  staffPost: string;
}

export interface ScopedRow {
  institutionId?: string;
  region?: string;
  country?: string;
}

export function isSuperDesk(actor: Pick<DeskActor, 'staffRole'>): boolean {
  return actor.staffRole === 'super_admin';
}

export function canOpenDesk(actor: Pick<DeskActor, 'staffRole'>): boolean {
  return actor.staffRole === 'super_admin' || actor.staffRole === 'admin';
}

/** An admin with no institution and no region sees no scoped row. */
export function inDeskScope(actor: DeskActor, row: ScopedRow): boolean {
  if (isSuperDesk(actor)) return true;
  if (actor.staffRole !== 'admin') return false;
  if (actor.institutionId && row.institutionId && row.institutionId === actor.institutionId) return true;
  if (actor.region && row.region && row.region.toLowerCase() === actor.region.toLowerCase()) return true;
  if (!row.institutionId && !row.region && actor.country && row.country && row.country.toLowerCase() === actor.country.toLowerCase()) return true;
  return false;
}

export function hideSafeguardingIdentity(actor: { staffRole?: string | null; staffPost?: string | null }): boolean {
  if (actor.staffRole === 'super_admin') return false;
  if (actor.staffPost === 'safeguarding_lead') return false;
  return actor.staffRole === 'admin';
}

export function visibleCaseTitle(title: string, actor: { staffRole?: string | null; staffPost?: string | null }, sensitive: boolean): string {
  if (!sensitive || !hideSafeguardingIdentity(actor)) return title;
  return 'Safeguarding case';
}

export function decideTierChange(input: {
  actor: DeskActor;
  targetStaffRole: string | null;
  targetInstitutionId: string;
  targetRegion: string;
  targetCountry: string;
  nextTier: number;
  reason: string;
}): { ok: true } | { ok: false; error: string } {
  if (!canOpenDesk(input.actor)) return { ok: false, error: 'This account cannot change a verification tier.' };
  if (!input.reason.trim()) return { ok: false, error: 'A reason is required.' };
  if (!Number.isInteger(input.nextTier) || input.nextTier < 0 || input.nextTier > 4) {
    return { ok: false, error: 'Choose a tier from 0 to 4.' };
  }
  if (input.targetStaffRole === 'super_admin' && !isSuperDesk(input.actor)) {
    return { ok: false, error: 'Only a super admin can change a super admin.' };
  }
  if (!inDeskScope(input.actor, {
    institutionId: input.targetInstitutionId,
    region: input.targetRegion,
    country: input.targetCountry,
  })) {
    return { ok: false, error: 'That account is outside your institution or region.' };
  }
  return { ok: true };
}

export function decideSuspend(input: {
  actor: DeskActor;
  targetStaffRole: string | null;
  targetInstitutionId: string;
  targetRegion: string;
  targetCountry: string;
  reason: string;
}): { ok: true } | { ok: false; error: string } {
  if (!canOpenDesk(input.actor)) return { ok: false, error: 'This account cannot suspend anyone.' };
  if (!input.reason.trim()) return { ok: false, error: 'A reason is required.' };
  if (input.targetStaffRole === 'super_admin' && !isSuperDesk(input.actor)) {
    return { ok: false, error: 'Only a super admin can change a super admin.' };
  }
  if (!inDeskScope(input.actor, {
    institutionId: input.targetInstitutionId,
    region: input.targetRegion,
    country: input.targetCountry,
  })) {
    return { ok: false, error: 'That account is outside your institution or region.' };
  }
  return { ok: true };
}

export function recordAmberApproval(input: {
  actorUid: string;
  reason: string;
  approvers: string[];
}): { ok: true; approvers: string[]; ready: boolean } | { ok: false; error: string } {
  if (!input.reason.trim()) return { ok: false, error: 'A reason is required.' };
  if (input.approvers.includes(input.actorUid)) return { ok: false, error: 'You already approved this Amber alert.' };
  const approvers = [...input.approvers, input.actorUid];
  return { ok: true, approvers, ready: approvers.length >= 2 };
}

export function confirmBroadcast(input: {
  actor: Pick<DeskActor, 'staffRole'>;
  category: string;
  audience: string;
  body: string;
  confirmation: string;
}): { ok: true } | { ok: false; error: string } {
  if (!isSuperDesk(input.actor)) return { ok: false, error: 'Only a super admin can send a platform broadcast.' };
  if (!(BROADCAST_CATEGORIES as readonly string[]).includes(input.category)) {
    return { ok: false, error: 'Choose a broadcast category.' };
  }
  if (input.audience.trim().length < 2) return { ok: false, error: 'Choose who should receive it.' };
  if (input.body.trim().length < 2) return { ok: false, error: 'Write the message.' };
  if (input.confirmation.trim() !== BROADCAST_CONFIRM) return { ok: false, error: 'Type SEND to confirm the broadcast.' };
  return { ok: true };
}

export function slaRemaining(dueAt: number, now: number): { breached: boolean; label: string } {
  if (!Number.isFinite(dueAt) || dueAt <= 0) return { breached: false, label: 'No timer' };
  const delta = dueAt - now;
  if (delta < 0) {
    const minutes = Math.ceil(Math.abs(delta) / 60000);
    return { breached: true, label: `${minutes} min over` };
  }
  const minutes = Math.ceil(delta / 60000);
  return { breached: false, label: `${minutes} min left` };
}

export function bucketSeries(stamps: number[], now: number, days = 7): number[] {
  const series = Array.from({ length: days }, () => 0);
  const day = 24 * 60 * 60 * 1000;
  for (const stamp of stamps) {
    if (!Number.isFinite(stamp) || stamp <= 0) continue;
    const index = days - 1 - Math.floor((now - stamp) / day);
    if (index >= 0 && index < days) series[index] += 1;
  }
  return series;
}
