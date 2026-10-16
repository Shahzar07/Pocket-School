/**
 * Confirm a Firebase ID token belongs to a platform admin before an AI
 * write. The browser never receives a service account. If the token is
 * missing or the cert check fails, the caller returns 401 and the studio
 * keeps its local preview.
 */

import { createPublicKey, verify as verifySignature } from 'crypto';
import { adminFromVerifiedIdentity } from '@/lib/admin-access';

const PROJECT_ID = 'ringed-sentinel-436615-c2';
const DATABASE_ID = 'ai-studio-5cdc1a69-b213-49e8-8c41-756df00d9e15';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface TokenParts {
  header: { kid?: string; alg?: string };
  payload: { aud?: string; exp?: number; sub?: string; iss?: string; email?: string; role?: string; adminRole?: string };
  signingInput: string;
  signature: Buffer;
}

function decode(token: string): TokenParts | null {
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) return null;
  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString()) as TokenParts['header'];
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as TokenParts['payload'];
    return {
      header,
      payload,
      signingInput: `${headerPart}.${payloadPart}`,
      signature: Buffer.from(signaturePart, 'base64url'),
    };
  } catch {
    return null;
  }
}

export async function isPlatformAdmin(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const parts = token ? decode(token) : null;
  if (!parts || parts.header.alg !== 'RS256' || !parts.header.kid || !parts.payload.sub) return false;
  if (parts.payload.aud !== PROJECT_ID) return false;
  if (parts.payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return false;
  if (!parts.payload.exp || parts.payload.exp * 1000 < Date.now()) return false;

  try {
    const certs = await fetch(CERTS_URL).then(res => res.json() as Promise<Record<string, string>>);
    const pem = certs[parts.header.kid];
    if (!pem) return false;
    const key = createPublicKey(pem);
    const signed = verifySignature('RSA-SHA256', Buffer.from(parts.signingInput), key, parts.signature);
    if (!signed) return false;

    const claimRole = typeof parts.payload.role === 'string' ? parts.payload.role : '';
    const claimAdmin = typeof parts.payload.adminRole === 'string' ? parts.payload.adminRole : '';
    if (claimRole || claimAdmin) {
      return adminFromVerifiedIdentity({
        email: parts.payload.email,
        role: claimRole,
        adminRole: claimAdmin,
      });
    }

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${parts.payload.sub}`;
    const userRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!userRes.ok) return false;
    const doc = await userRes.json() as { fields?: { role?: { stringValue?: string } } };
    return doc.fields?.role?.stringValue === 'admin';
  } catch {
    return false;
  }
}
