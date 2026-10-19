import { createHmac, timingSafeEqual } from 'node:crypto';
import { GOOGLE_CALENDAR_SCOPE } from './config';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';

export function googleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
  });
  return `${AUTH}?${params.toString()}`;
}

export function signOAuthState(uid: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + 10 * 60 * 1000 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()): { uid: string } | null {
  const split = state.split('.');
  if (split.length !== 2) return null;
  const [payload, sig] = split;
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: string; exp?: number };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < now) return null;
    return { uid: parsed.uid };
  } catch {
    return null;
  }
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
}

export async function exchangeAuthCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleTokens | { error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
  });
  const response = await fetchImpl(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; error?: string };
  if (!response.ok || !json.access_token || !json.refresh_token) {
    return { error: 'Google Calendar did not return a refresh token. Remove Poket School in your Google account and connect again.' };
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string } | { error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  const response = await fetchImpl(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json().catch(() => ({})) as { access_token?: string };
  if (!response.ok || !json.access_token) return { error: 'Google Calendar refused the saved connection.' };
  return { accessToken: json.access_token };
}
