import { MAIL_BACKOFF_MS } from './types';

export async function sendWithBackoff<T extends { ok: boolean }>(
  send: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  let last: T | null = null;
  for (let attempt = 0; attempt < MAIL_BACKOFF_MS.length; attempt += 1) {
    const wait = MAIL_BACKOFF_MS[attempt] ?? 0;
    if (wait > 0) await sleep(wait);
    try {
      last = await send();
    } catch (error) {
      last = { ok: false, error: error instanceof Error ? error.message : 'Send failed.' } as unknown as T;
    }
    if (last.ok) return last;
  }
  return last as T;
}
