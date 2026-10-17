/**
 * Optional identity-check provider. It stays off until ID_CHECK_API_KEY is set.
 * No vendor call is made without that key.
 */

function envValue(env: object | undefined, key: string): string {
  if (!env) return '';
  const value = (env as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function idCheckReady(env: object = process.env): boolean {
  return envValue(env, 'ID_CHECK_API_KEY').length > 0;
}

export async function requestIdCheck(input: {
  uid: string;
  env?: object;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; skipped: boolean; reason: string }> {
  const env = input.env ?? process.env;
  if (!idCheckReady(env)) {
    return { ok: false, skipped: true, reason: 'ID check is off until a key is set.' };
  }
  const url = envValue(env, 'ID_CHECK_URL');
  if (!url) {
    return { ok: false, skipped: true, reason: 'ID check has a key but no provider URL.' };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${envValue(env, 'ID_CHECK_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid: input.uid }),
  });
  if (!response.ok) return { ok: false, skipped: false, reason: 'The ID check provider declined the request.' };
  return { ok: true, skipped: false, reason: '' };
}
