import { SETUP_NEEDED_MESSAGE } from './copy';

export { SETUP_NEEDED_MESSAGE };

/** True when this process can write bytes to the bucket (emulator or a credential). */
export function canWriteStorage(): boolean {
  return Boolean(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST
    || process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

/**
 * Signed URLs need the Vercel service-account JSON. The emulator host is not a signing key.
 * Callers must refuse the download instead of returning a stand-in URL.
 */
export function canSignDownloads(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { private_key?: unknown };
    return typeof parsed.private_key === 'string' && parsed.private_key.includes('PRIVATE KEY');
  } catch {
    return false;
  }
}
