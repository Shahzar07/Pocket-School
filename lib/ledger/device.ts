import { createHash } from 'crypto';
import { type ChainDevice } from './chain';

export const SERVER_DEVICE: ChainDevice = {
  platform: 'server',
  appVersion: 'web',
  ipHash: createHash('sha256').update('server').digest('hex'),
};

export function hashActor(uid: string): string {
  if (!uid) return 'anonymous';
  return createHash('sha256').update(uid).digest('hex');
}

export function deviceFromHeaders(headers: { get(name: string): string | null }): ChainDevice {
  const ip = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  return {
    platform: (headers.get('x-client-platform') ?? 'web').slice(0, 40),
    appVersion: (headers.get('x-app-version') ?? 'web').slice(0, 40),
    ipHash: createHash('sha256').update(ip).digest('hex'),
  };
}
