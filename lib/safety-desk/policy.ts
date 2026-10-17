/**
 * Poket School Safety Desk. People without a school submit here.
 * They never publish an Amber or emergency alert.
 */

export const DESK_ADDRESS = 'poket_safety_desk';
export const DESK_ACK_MS = 5 * 60 * 1000;

export interface RotaSlot {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  primaryUid: string;
  backupUid: string;
}

export interface OnCall {
  primaryUid: string;
  backupUid: string;
}

export function addressedToDesk(institutionId: string): boolean {
  return institutionId.trim() === '';
}

export function deskAddress(institutionId: string, schoolAddress: string): string {
  return addressedToDesk(institutionId) ? DESK_ADDRESS : schoolAddress;
}

export function cleanSlot(value: unknown): RotaSlot | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<RotaSlot>;
  const weekday = Number(row.weekday);
  const startMinutes = Number(row.startMinutes);
  const endMinutes = Number(row.endMinutes);
  const primaryUid = typeof row.primaryUid === 'string' ? row.primaryUid.trim() : '';
  const backupUid = typeof row.backupUid === 'string' ? row.backupUid.trim() : '';
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  if (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes > 24 * 60) return null;
  if (!Number.isFinite(endMinutes) || endMinutes <= startMinutes || endMinutes > 24 * 60) return null;
  if (!primaryUid) return null;
  return { weekday, startMinutes, endMinutes, primaryUid, backupUid };
}

export function onCallAt(slots: readonly RotaSlot[], weekday: number, minutes: number): OnCall {
  const match = slots.find(slot => slot.weekday === weekday && minutes >= slot.startMinutes && minutes < slot.endMinutes);
  if (!match) return { primaryUid: '', backupUid: '' };
  return { primaryUid: match.primaryUid, backupUid: match.backupUid };
}

/** Strictly after five minutes, and only once. */
export function deskNeedsEscalation(createdAt: number, ackAt: number, escalatedAt: number, now: number): boolean {
  if (!createdAt || ackAt || escalatedAt) return false;
  return now - createdAt > DESK_ACK_MS;
}

export function deskRecipients(input: {
  superAdminUids: readonly string[];
  primaryUid: string;
  backupUid: string;
  guardianUids: readonly string[];
  excludedParentUids: readonly string[];
  escalate: boolean;
}): string[] {
  const excluded = new Set(input.excludedParentUids);
  const ids = [
    ...input.superAdminUids,
    input.primaryUid,
    input.escalate ? input.backupUid : '',
    ...input.guardianUids,
  ];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const id of ids) {
    if (!id || excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    recipients.push(id);
  }
  return recipients;
}
