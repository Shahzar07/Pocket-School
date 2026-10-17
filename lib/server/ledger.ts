/**
 * The only writer for hotline events and emergency audit, updates, and consent.
 * It creates a document. It never updates or deletes one. The parent stores
 * the chain head so two writers cannot fork the sequence.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  GENESIS,
  sealEntry,
  verifyChain,
  type ChainDevice,
  type ChainDiff,
  type ChainEntry,
  type ChainVerdict,
} from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';

function db(): Firestore {
  return adminDb();
}

export interface AppendInput {
  parentPath: string;
  collection: 'events' | 'audit' | 'updates' | 'consent';
  actorUid: string;
  actorRole: string;
  action: string;
  diff: ChainDiff;
  device?: ChainDevice;
  extra?: Record<string, unknown>;
}

export async function appendChain(input: AppendInput): Promise<{ id: string; seq: number; hash: string }> {
  const parentRef = db().doc(input.parentPath);
  const entryRef = db().collection(`${input.parentPath}/${input.collection}`).doc();
  return db().runTransaction(async (tx) => {
    const parent = await tx.get(parentRef);
    if (!parent.exists) throw new Error('Log parent not found.');
    const seq = (Number(parent.data()?.chainSeq) || 0) + 1;
    const prevHash = typeof parent.data()?.chainHead === 'string' && parent.data()?.chainHead
      ? String(parent.data()?.chainHead)
      : GENESIS;
    const serverTimestamp = Date.now();
    const reserved = new Set(['hash', 'prevHash', 'seq', 'actorUid', 'actorRole', 'action', 'diff', 'serverTimestamp', 'at', 'device', 'stream']);
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input.extra ?? {})) {
      if (!reserved.has(key) && value !== undefined) extra[key] = value;
    }
    const sealed = sealEntry(prevHash, {
      ...extra,
      seq,
      actorUid: input.actorUid,
      actorRole: input.actorRole,
      action: input.action,
      diff: input.diff,
      serverTimestamp,
      at: serverTimestamp,
      device: input.device ?? SERVER_DEVICE,
      stream: input.collection,
    });
    tx.create(entryRef, sealed);
    tx.update(parentRef, { chainSeq: seq, chainHead: sealed.hash });
    return { id: entryRef.id, seq, hash: sealed.hash };
  });
}

const STREAMS: Record<'ticket' | 'alert', Array<'events' | 'audit' | 'updates' | 'consent'>> = {
  ticket: ['events'],
  alert: ['audit', 'updates', 'consent'],
};

async function loadStream(path: string): Promise<ChainEntry[]> {
  const entries: ChainEntry[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (let page = 0; page < 20; page += 1) {
    let query: FirebaseFirestore.Query = db().collection(path).orderBy('seq').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    for (const doc of snap.docs) entries.push(doc.data() as ChainEntry);
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.size < 100) break;
  }
  return entries;
}

export async function readChain(kind: 'ticket' | 'alert', id: string): Promise<{ entries: ChainEntry[]; head: string }> {
  const parentPath = kind === 'ticket' ? `hotline_tickets/${id}` : `emergency_alerts/${id}`;
  const parent = await db().doc(parentPath).get();
  if (!parent.exists) throw new Error('Log parent not found.');
  const entries: ChainEntry[] = [];
  for (const stream of STREAMS[kind]) {
    entries.push(...await loadStream(`${parentPath}/${stream}`));
  }
  return { entries, head: String(parent.data()?.chainHead || GENESIS) };
}

export async function verifyStoredChain(kind: 'ticket' | 'alert', id: string): Promise<ChainVerdict & { entries: number }> {
  const loaded = await readChain(kind, id);
  const verdict = verifyChain(loaded.entries, loaded.head);
  return { ...verdict, entries: loaded.entries.length };
}
