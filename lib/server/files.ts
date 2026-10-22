/**
 * Signed URLs for hotline and alert files. Clients cannot read the bucket.
 * Images get a second metadata pass so GPS is gone even after the marker strip.
 */

import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { adminApp } from '../firebase-admin';

const TEN_MINUTES = 10 * 60 * 1000;

export function bytesFromBase64(value: string): Uint8Array | null {
  if (!value || value.length > 70_000_000) return null;
  try {
    return new Uint8Array(Buffer.from(value, 'base64'));
  } catch {
    return null;
  }
}

export async function imagePass(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (!mime.startsWith('image/')) return bytes;
  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(Buffer.from(bytes), { failOn: 'none' }).rotate().toBuffer();
    return new Uint8Array(out);
  } catch {
    return bytes;
  }
}

function bucket() {
  return getStorage(adminApp()).bucket(firebaseConfig.storageBucket);
}

export async function saveObject(path: string, bytes: Uint8Array, mime: string): Promise<void> {
  await bucket().file(path).save(Buffer.from(bytes), {
    contentType: mime,
    resumable: false,
    metadata: { metadata: { exifStripped: 'true' } },
  });
}

export async function readObject(path: string): Promise<Buffer> {
  const [bytes] = await bucket().file(path).download();
  return bytes;
}

export async function signedRead(path: string): Promise<{ url: string; expiresAt: number }> {
  const expiresAt = Date.now() + TEN_MINUTES;
  const [url] = await bucket().file(path).getSignedUrl({ action: 'read', expires: expiresAt });
  return { url, expiresAt };
}

export async function removeObject(path: string): Promise<void> {
  if (!path) return;
  await bucket().file(path).delete({ ignoreNotFound: true });
}
