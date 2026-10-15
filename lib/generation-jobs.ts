/** Per-block generation state. A job that never finishes is shown as failed. */

export type GenerationStatus = 'queued' | 'generating' | 'done' | 'failed';

export interface GenerationJob {
  status: GenerationStatus;
  error?: string;
  updatedAt: number;
}

const STALE_MS = 3 * 60 * 1000;

export function jobUpdate(
  current: Record<string, GenerationJob> | undefined,
  format: string,
  status: GenerationStatus,
  now: number,
  error?: string,
): Record<string, GenerationJob> {
  return {
    ...(current ?? {}),
    [format]: { status, updatedAt: now, ...(error ? { error } : {}) },
  };
}

/** Queued or generating work older than three minutes did not finish. */
export function visibleJob(job: GenerationJob | undefined, now: number): GenerationJob | null {
  if (!job) return null;
  if ((job.status === 'queued' || job.status === 'generating') && now - job.updatedAt > STALE_MS) {
    return { status: 'failed', updatedAt: job.updatedAt, error: 'The generator stopped before it finished.' };
  }
  return job;
}
