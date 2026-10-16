import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import firebaseConfig from '../firebase-applet-config.json';

export interface VerifiedIdentity {
  uid: string;
  email: string;
  customAttributes: Record<string, unknown>;
}

/**
 * Firebase ID tokens are RS256 JWTs. Google publishes the signing keys;
 * issuer and audience pin the token to this project. No Admin SDK and no
 * API key — accounts:lookup fails when the client key is referrer-locked.
 */
const PROJECT_ID = firebaseConfig.projectId;
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export function identityFromPayload(payload: JWTPayload): VerifiedIdentity | null {
  const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!uid || !email || !email.includes('@')) return null;
  const customAttributes: Record<string, unknown> = {};
  if (typeof payload.role === 'string') customAttributes.role = payload.role;
  if (typeof payload.adminRole === 'string') customAttributes.adminRole = payload.adminRole;
  return { uid, email, customAttributes };
}

export async function lookupIdToken(idToken: string): Promise<VerifiedIdentity | null> {
  const token = idToken.trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
      clockTolerance: 30,
    });
    return identityFromPayload(payload);
  } catch {
    return null;
  }
}

export function bearerToken(header: string | null): string {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}
