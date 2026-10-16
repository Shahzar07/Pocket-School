import firebaseConfig from '../firebase-applet-config.json';

export interface VerifiedIdentity {
  uid: string;
  email: string;
  customAttributes: Record<string, unknown>;
}

/**
 * Verify a Firebase ID token without the Admin SDK.
 * Production can answer this when FIREBASE_SERVICE_ACCOUNT is unset.
 * The same accounts:lookup call is used by the admin console.
 */
export async function lookupIdToken(idToken: string): Promise<VerifiedIdentity | null> {
  const token = idToken.trim();
  if (!token) return null;
  let response: Response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = await response.json() as {
    users?: Array<{ localId?: string; email?: string; customAttributes?: string }>;
  };
  const user = body.users?.[0];
  if (!user?.localId) return null;
  let customAttributes: Record<string, unknown> = {};
  if (typeof user.customAttributes === 'string' && user.customAttributes) {
    try {
      const parsed: unknown = JSON.parse(user.customAttributes);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        customAttributes = parsed as Record<string, unknown>;
      }
    } catch {
      customAttributes = {};
    }
  }
  return {
    uid: user.localId,
    email: (user.email ?? '').trim().toLowerCase(),
    customAttributes,
  };
}

export function bearerToken(header: string | null): string {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}
