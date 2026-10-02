import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Verify a Firebase ID token without the Admin SDK.
 *
 * Firebase ID tokens are RS256 JWTs signed by Google's securetoken service.
 * Checking the signature against Google's published keys, plus issuer and
 * audience, is exactly what the Admin SDK does — and it needs no service
 * account, which this deployment doesn't have.
 *
 * The AI routes cost money per call. Before this, anyone on the internet
 * could call them directly.
 */

const PROJECT_ID = firebaseConfig.projectId;
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export interface AuthedUser { uid: string; email?: string }

export class AuthError extends Error {
  status = 401;
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError('Sign in to use this feature.');
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no subject');
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    throw new AuthError('Your session has expired. Please sign in again.');
  }
}

/** Turn an error into the JSON response every study route returns. */
export function errorResponse(err: unknown, fallback = 'Something went wrong.') {
  const status = err instanceof AuthError ? 401 : 500;
  const message = err instanceof Error && err.message ? err.message : fallback;
  if (status === 500) console.error('[study]', err);
  return Response.json({ error: message }, { status });
}
