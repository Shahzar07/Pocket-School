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

function decodeJwtPart(part: string): unknown {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

/**
 * The Auth emulator issues unsigned tokens. Accept those only while this
 * process is explicitly pointed at the emulator. Production tokens stay on
 * Google's signed-token check below.
 */
function emulatorUser(token: string): AuthedUser | null {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decodeJwtPart(parts[0]) as { alg?: string };
    if (header.alg !== 'none') return null;
    const payload = decodeJwtPart(parts[1]) as { sub?: string; aud?: string; iss?: string; email?: string };
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (payload.aud !== PROJECT_ID) return null;
    if (!payload.sub) return null;
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError('Sign in to use this feature.');
  const emulator = emulatorUser(token);
  if (emulator) return emulator;
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
