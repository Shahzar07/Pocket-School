import { createHash } from 'node:crypto';
import type { MyInvoisDocument } from './tax';

export const MYINVOIS_MAX_ATTEMPTS = 5;

export type MyInvoisStatus = 'not_configured' | 'queued' | 'submitted' | 'retry' | 'failed';

export interface MyInvoisEnv {
  clientId?: string;
  clientSecret?: string;
  tin?: string;
  /** `production` uses the live host. Anything else is the sandbox. */
  mode?: string;
}

export interface MyInvoisReady {
  ready: true;
  clientId: string;
  clientSecret: string;
  tin: string;
  host: string;
  mode: 'sandbox' | 'production';
}

export interface MyInvoisOff {
  ready: false;
  status: 'not_configured';
  detail: string;
}

const SANDBOX = 'https://preprod-api.myinvois.hasil.gov.my';
const PRODUCTION = 'https://api.myinvois.hasil.gov.my';

export function myInvoisEnv(source: MyInvoisEnv = {
  clientId: process.env.MYINVOIS_CLIENT_ID,
  clientSecret: process.env.MYINVOIS_CLIENT_SECRET,
  tin: process.env.TIN || process.env.MYINVOIS_TIN,
  mode: process.env.MYINVOIS_ENV,
}): MyInvoisReady | MyInvoisOff {
  const clientId = source.clientId?.trim() ?? '';
  const clientSecret = source.clientSecret?.trim() ?? '';
  const tin = source.tin?.trim() ?? '';
  const missing = [
    !clientId ? 'MYINVOIS_CLIENT_ID' : '',
    !clientSecret ? 'MYINVOIS_CLIENT_SECRET' : '',
    !tin ? 'TIN' : '',
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      ready: false,
      status: 'not_configured',
      detail: `MyInvois is not configured. Set ${missing.join(', ')}. Paid invoices stay queued with this status and are not sent.`,
    };
  }
  const mode = source.mode?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  return {
    ready: true,
    clientId,
    clientSecret,
    tin,
    host: mode === 'production' ? PRODUCTION : SANDBOX,
    mode,
  };
}

export function nextRetryAt(attempts: number, now: number): number {
  const wait = Math.min(60, 2 ** Math.max(1, attempts)) * 60_000;
  return now + wait;
}

export function documentHash(json: string): string {
  return createHash('sha256').update(json).digest('hex');
}

export function submissionBody(document: MyInvoisDocument, codeNumber: string): {
  documents: { format: 'JSON'; document: string; documentHash: string; codeNumber: string }[];
} {
  const json = JSON.stringify(document);
  return {
    documents: [{
      format: 'JSON',
      document: Buffer.from(json).toString('base64'),
      documentHash: documentHash(json),
      codeNumber: codeNumber.slice(0, 50),
    }],
  };
}

export function shouldRetry(status: number, attempts: number): boolean {
  if (attempts >= MYINVOIS_MAX_ATTEMPTS) return false;
  if (status === 429 || status >= 500 || status === 401) return true;
  return false;
}
