/**
 * Tamper-evident hash chain for hotline events and emergency audit,
 * updates, and consent. Entries are created once. The hash covers every
 * field except `hash` itself.
 *
 * hash = SHA-256(prevHash + canonical JSON of the entry).
 * `serverTimestamp` is the millisecond clock taken inside the transaction
 * so the hash can be recomputed. It is not a Firestore sentinel.
 */

import { createHash } from 'crypto';

export const GENESIS = '0'.repeat(64);

export interface ChainDevice {
  platform: string;
  appVersion: string;
  ipHash: string;
}

export interface ChainDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ChainEntry {
  seq: number;
  actorUid: string;
  actorRole: string;
  action: string;
  diff: ChainDiff;
  serverTimestamp: number;
  device: ChainDevice;
  prevHash: string;
  hash: string;
  stream?: string;
  [key: string]: unknown;
}

export interface ChainVerdict {
  ok: boolean;
  head: string;
  brokenAt: number | null;
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(key => key !== 'hash' && record[key] !== undefined).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function chainHash(prevHash: string, entry: Record<string, unknown>): string {
  return createHash('sha256').update(`${prevHash}${canonicalJson(entry)}`).digest('hex');
}

export function sealEntry(prevHash: string, entry: Omit<ChainEntry, 'hash' | 'prevHash'> & Record<string, unknown>): ChainEntry {
  const body = { ...entry, prevHash };
  return { ...body, hash: chainHash(prevHash, body) } as ChainEntry;
}

/** Checks sequence, previous hash, and the recomputed SHA-256 link. */
export function verifyChain(entries: ChainEntry[], expectedHead = ''): ChainVerdict {
  const sorted = [...entries].sort((left, right) => left.seq - right.seq);
  let prev = GENESIS;
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (!entry || entry.seq !== index + 1 || entry.prevHash !== prev) {
      return { ok: false, head: prev, brokenAt: entry?.seq ?? index + 1 };
    }
    if (chainHash(entry.prevHash, entry) !== entry.hash) {
      return { ok: false, head: prev, brokenAt: entry.seq };
    }
    prev = entry.hash;
  }
  const head = sorted.length ? prev : GENESIS;
  if (expectedHead && expectedHead !== head) return { ok: false, head, brokenAt: sorted.length };
  return { ok: true, head, brokenAt: null };
}

export const SHARE_CHANNELS = ['whatsapp', 'facebook', 'x', 'copy'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export function isShareChannel(value: string): value is ShareChannel {
  return (SHARE_CHANNELS as readonly string[]).includes(value);
}

/** Where a logged share sends the visitor. Copy link returns to the alert page. */
export function shareLocation(origin: string, id: string, channel: ShareChannel, pagePath = `/amber/${id}`): string {
  const path = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const page = `${origin.replace(/\/$/, '')}${path}`;
  const text = encodeURIComponent(page);
  if (channel === 'whatsapp') return `https://wa.me/?text=${text}`;
  if (channel === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${text}`;
  if (channel === 'x') return `https://twitter.com/intent/tweet?url=${text}`;
  return page;
}

/** Hotline tickets are never shared. An alert share has to be active and public. */
export function shareRefusal(kind: 'hotline' | 'alert', status: string, shareEnabled: boolean): string | null {
  if (kind === 'hotline') return 'Hotline tickets cannot be shared.';
  if (status !== 'active' && status !== 'updated') return 'Only an active public alert can be shared.';
  if (!shareEnabled) return 'This alert is not public.';
  return null;
}

export interface LegalHold {
  on: boolean;
  by: string;
  at: number;
  reason: string;
}

export function emptyLegalHold(): LegalHold {
  return { on: false, by: '', at: 0, reason: '' };
}

export function canManageLegalHold(role: string, staffPost: string): boolean {
  return role === 'admin' || staffPost === 'principal';
}

export function internalRedactionBlocked(hold: Partial<LegalHold> | null | undefined): boolean {
  return hold?.on === true;
}
