'use client';

import { authedFetch } from '@/lib/authed-fetch';

/** POST and read a plain-text stream, calling onDelta with the text so far. */
export async function streamText(
  url: string,
  body: unknown,
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await authedFetch(url, { method: 'POST', body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  return full;
}

export { parseTutorReply, type Verdict } from './tutor-reply';
