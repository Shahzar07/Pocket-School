import 'server-only';

import { randomBytes } from 'node:crypto';
import { adminAuth, adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { linkedInAuthorizeUrl, linkedInSignInEnabled, memberShareDecision, shareTokenFrom } from '@/lib/linkedin';

export function linkedInPublicConfig(): { enabled: boolean; organizationId: string; memberShare: boolean } {
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? '';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? '';
  return {
    enabled: linkedInSignInEnabled({ clientId, clientSecret }),
    organizationId: (process.env.LINKEDIN_ORGANIZATION_ID ?? '').trim(),
    memberShare: memberShareDecision({ flag: process.env.LINKEDIN_MEMBER_SHARE, hasMemberToken: false }).allowed,
  };
}

export function linkedInRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/auth/linkedin/callback`;
}

export async function beginLinkedIn(input: {
  origin: string;
  mode: 'login' | 'link';
  uid?: string;
}): Promise<{ url: string; state: string } | { error: string }> {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? '').trim();
  if (!linkedInSignInEnabled({ clientId, clientSecret })) {
    return { error: 'Sign in with LinkedIn is off until LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are set.' };
  }
  if (!isAdminConfigured()) {
    return { error: 'LinkedIn sign-in needs the server account tools configured.' };
  }
  if (input.mode === 'link' && !input.uid) return { error: 'Sign in with Poket School first, then link LinkedIn.' };
  const state = shareTokenFrom(randomBytes(24));
  await adminDb().doc(`linkedin_nonces/${state}`).set({
    mode: input.mode,
    uid: input.uid ?? '',
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return {
    state,
    url: linkedInAuthorizeUrl({
      clientId,
      redirectUri: linkedInRedirectUri(input.origin),
      state,
    }),
  };
}

interface LinkedInIdentity {
  sub: string;
}

export async function finishLinkedIn(input: {
  origin: string;
  code: string;
  state: string;
}): Promise<{ mode: 'login'; token: string } | { mode: 'link'; uid: string } | { error: string }> {
  if (!isAdminConfigured()) return { error: 'LinkedIn sign-in needs the server account tools configured.' };
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? '').trim();
  if (!linkedInSignInEnabled({ clientId, clientSecret })) {
    return { error: 'Sign in with LinkedIn is off until LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are set.' };
  }
  const nonceRef = adminDb().doc(`linkedin_nonces/${input.state}`);
  const nonce = await nonceRef.get();
  const expiresAt = typeof nonce.get('expiresAt') === 'number' ? nonce.get('expiresAt') : 0;
  if (!nonce.exists || expiresAt < Date.now()) {
    return { error: 'This LinkedIn sign-in expired. Start again.' };
  }
  await nonceRef.delete();
  const mode = nonce.get('mode') === 'link' ? 'link' : 'login';
  const identity = await linkedInIdentity({
    code: input.code,
    redirectUri: linkedInRedirectUri(input.origin),
    clientId,
    clientSecret,
  });
  if ('error' in identity) return identity;
  const existing = await adminDb().collection('users').where('linkedInSub', '==', identity.sub).limit(1).get();
  if (mode === 'link') {
    const uid = typeof nonce.get('uid') === 'string' ? nonce.get('uid') : '';
    if (!uid) return { error: 'Sign in with Poket School first, then link LinkedIn.' };
    const other = existing.docs.find((doc) => doc.id !== uid);
    if (other) return { error: 'This LinkedIn account is already linked to another Poket School account.' };
    await adminDb().doc(`users/${uid}`).set({ linkedInSub: identity.sub }, { merge: true });
    return { mode: 'link', uid };
  }
  const user = existing.docs[0];
  if (!user) return { error: 'Sign in with Poket School first, then link LinkedIn from your portfolio.' };
  const token = await adminAuth().createCustomToken(user.id);
  return { mode: 'login', token };
}

async function linkedInIdentity(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<LinkedInIdentity | { error: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenResponse.ok) return { error: 'LinkedIn did not confirm this sign-in.' };
  const tokenJson = await tokenResponse.json() as { access_token?: string };
  const accessToken = tokenJson.access_token ?? '';
  if (!accessToken) return { error: 'LinkedIn did not confirm this sign-in.' };
  const profile = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profile.ok) return { error: 'LinkedIn did not return a profile.' };
  const user = await profile.json() as { sub?: string };
  const sub = typeof user.sub === 'string' ? user.sub.trim() : '';
  if (!sub) return { error: 'LinkedIn did not return a profile.' };
  return { sub };
}

export function memberShareResponse(): { allowed: false; error: string } {
  const decision = memberShareDecision({
    flag: process.env.LINKEDIN_MEMBER_SHARE,
    hasMemberToken: false,
  });
  return {
    allowed: false,
    error: decision.allowed
      ? 'A member post needs a stored w_member_social token. Sign-in does not request that permission.'
      : decision.reason,
  };
}
