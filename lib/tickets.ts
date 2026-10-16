export const TICKET_STATUSES = ['open', 'pending', 'kiv', 'solved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Older rows used in_progress and resolved. */
export function canonicalStatus(status: string): TicketStatus {
  if (status === 'in_progress') return 'pending';
  if (status === 'resolved' || status === 'solved') return 'solved';
  if (status === 'pending' || status === 'kiv' || status === 'closed' || status === 'open') return status;
  return 'open';
}

export function statusLabel(status: string): string {
  const canonical = canonicalStatus(status);
  return canonical === 'kiv' ? 'KIV' : canonical;
}

export function ticketNumber(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `PS-${compact.padStart(6, '0')}`;
}

export function slaHours(priority: string): number {
  if (priority === 'urgent') return 4;
  if (priority === 'high') return 24;
  if (priority === 'low') return 120;
  return 48;
}

export function slaDue(createdAtMs: number, priority: string): number {
  return createdAtMs + slaHours(priority) * 60 * 60 * 1000;
}
