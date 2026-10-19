import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function calendarKey(secret: string): Buffer {
  return createHash('sha256').update(`poket-google-calendar:${secret}`).digest();
}

/** AES-256-GCM. The refresh token never leaves the server. */
export function encryptRefreshToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', calendarKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptRefreshToken(payload: string, secret: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', calendarKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
