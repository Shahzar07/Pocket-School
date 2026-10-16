import 'server-only';
import type { KeyObject } from 'node:crypto';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import {
  generateBadgeKey,
  privateKeyFromPem,
  privateKeyToPem,
  publicFromPrivate,
  publicKeyFromPem,
  publicKeyMultibase,
  publicKeyToPem,
} from '@/lib/credentials/open-badge';

export interface BadgeSigner {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyMultibase: string;
}

const KEY_PATH = 'credential_keys/poket-school';

function fromPem(pem: string): BadgeSigner {
  const privateKey = privateKeyFromPem(pem);
  const publicKey = publicFromPrivate(privateKey);
  return { privateKey, publicKey, publicKeyMultibase: publicKeyMultibase(publicKey) };
}

/** The env key wins when it is set. Otherwise the server keeps one key in Firestore. */
export async function loadBadgeSigner(): Promise<BadgeSigner> {
  const fromEnv = process.env.OPEN_BADGE_PRIVATE_KEY?.trim();
  if (fromEnv) return fromPem(fromEnv);
  if (!isAdminConfigured()) throw new Error('Badge signing is not configured.');
  const ref = adminDb().doc(KEY_PATH);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pem = snap.data()?.privateKeyPem;
    if (typeof pem === 'string' && pem.includes('PRIVATE KEY')) return fromPem(pem);
    const generated = generateBadgeKey();
    const privatePem = privateKeyToPem(generated.privateKey);
    tx.set(ref, {
      privateKeyPem: privatePem,
      publicKeyPem: publicKeyToPem(generated.publicKey),
      publicKeyMultibase: publicKeyMultibase(generated.publicKey),
      createdAt: Date.now(),
    });
    return {
      privateKey: generated.privateKey,
      publicKey: generated.publicKey,
      publicKeyMultibase: publicKeyMultibase(generated.publicKey),
    };
  });
}

export async function verificationKeys(): Promise<KeyObject[]> {
  const keys: KeyObject[] = [];
  const fromEnv = process.env.OPEN_BADGE_PRIVATE_KEY?.trim();
  if (fromEnv) keys.push(publicFromPrivate(privateKeyFromPem(fromEnv)));
  if (isAdminConfigured()) {
    const snap = await adminDb().doc(KEY_PATH).get();
    const pem = snap.data()?.publicKeyPem;
    if (typeof pem === 'string' && pem.includes('PUBLIC KEY')) keys.push(publicKeyFromPem(pem));
  }
  if (keys.length === 0) {
    const signer = await loadBadgeSigner();
    keys.push(signer.publicKey);
  }
  return keys;
}
