/** Network and Firestore transport failures that are worth one more try. */

const TRANSIENT = /ERR_HTTP2_PING_FAILED|ERR_TIMED_OUT|ERR_CONNECTION_CLOSED|ERR_NETWORK|ECONNRESET|ETIMEDOUT|network error|failed to fetch|timeout|unavailable|deadline-exceeded/i;

export function isTransientError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? '');
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/resource-exhausted|permission-denied|unauthenticated|invalid-argument/i.test(code + message)) return false;
  return TRANSIENT.test(code) || TRANSIENT.test(message) || code === 'unavailable' || code === 'deadline-exceeded';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBackoff<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isTransientError(error) || i === attempts - 1) throw error;
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

/** Retry a fetch when the connection drops. 4xx (except 429) is returned as-is. */
export async function fetchWithBackoff(input: RequestInfo | URL, init?: RequestInit, attempts = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(input, init);
      if ((response.status >= 500 || response.status === 429) && i < attempts - 1) {
        await sleep(400 * 2 ** i);
        continue;
      }
      return response;
    } catch (error) {
      last = error;
      if (i === attempts - 1) throw error;
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}
