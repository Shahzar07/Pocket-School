/** Whether a webhook should run fulfillment. A processed event is never repeated. */

export interface EventClaim {
  status: 'processing' | 'processed' | 'error';
  at: number;
}

const PROCESSING_LOCK_MS = 120_000;

export function claimDecision(existing: EventClaim | null, now: number): 'process' | 'skip' {
  if (!existing) return 'process';
  if (existing.status === 'processed') return 'skip';
  if (existing.status === 'processing' && now - existing.at < PROCESSING_LOCK_MS) return 'skip';
  return 'process';
}

export function eventDocId(provider: string, eventId: string): string {
  const safe = `${provider}:${eventId}`.replace(/[/\s]/g, '_');
  return safe.slice(0, 700);
}
