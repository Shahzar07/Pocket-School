import 'server-only';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { isSuperAdminEmail } from '@/lib/roles';
import { AuthError, requireUser, type AuthedUser } from '@/lib/server-auth';
import { EXAM_PACKS, type ExamPack } from './exam-packs';
import type { PackStore } from './pack-admin';
import { mergeCatalog, normaliseRemotePack, planImport, type RemotePack } from './pack-record';

export const EXAM_PACKS_COLLECTION = 'exam_packs';

export class PackHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PackHttpError';
  }
}

export async function requirePlatformAdmin(req: Request): Promise<AuthedUser> {
  const user = await requireUser(req);
  if (isSuperAdminEmail(user.email)) return user;
  const snap = await adminDb().doc(`users/${user.uid}`).get();
  const role = snap.exists ? String(snap.get('role') ?? '') : '';
  if (role !== 'admin') throw new PackHttpError('Admin access required.', 403);
  return user;
}

export async function listRemote(): Promise<RemotePack[]> {
  if (!isAdminConfigured()) return [];
  const snap = await adminDb().collection(EXAM_PACKS_COLLECTION).limit(200).get();
  return snap.docs
    .map(docSnap => normaliseRemotePack(docSnap.data()))
    .filter((pack): pack is RemotePack => pack !== null);
}

async function writeRemote(pack: RemotePack, uid: string) {
  await adminDb().collection(EXAM_PACKS_COLLECTION).doc(pack.id).set({
    ...pack,
    updatedAt: Date.now(),
    updatedBy: uid,
  });
}

export async function saveRemotePack(input: unknown, uid: string): Promise<ExamPack[]> {
  const pack = normaliseRemotePack(input);
  if (!pack || pack.status === 'hidden') throw new PackHttpError('Give the pack a name, a topic, and draft or published status.', 400);
  await writeRemote(pack, uid);
  return mergeCatalog(await listRemote(), { includeDrafts: true });
}

export async function deleteRemotePack(id: string, uid: string): Promise<ExamPack[]> {
  const packId = id.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(packId)) throw new PackHttpError('Unknown pack.', 400);
  const ref = adminDb().collection(EXAM_PACKS_COLLECTION).doc(packId);
  if (EXAM_PACKS.some(pack => pack.id === packId)) {
    const tombstone = normaliseRemotePack({ id: packId, name: packId, status: 'hidden', units: [], freeFirstTopic: false });
    if (!tombstone) throw new PackHttpError('Unknown pack.', 400);
    await writeRemote(tombstone, uid);
  } else {
    await ref.delete();
  }
  return mergeCatalog(await listRemote(), { includeDrafts: true });
}

export async function importRemotePacks(store: PackStore, uid: string): Promise<ExamPack[]> {
  const existing = await listRemote();
  const writes = planImport(new Set(existing.map(pack => pack.id)), store);
  for (const pack of writes) await writeRemote(pack, uid);
  return mergeCatalog(writes.length ? await listRemote() : existing, { includeDrafts: true });
}

export async function adminCatalog(): Promise<ExamPack[]> {
  return mergeCatalog(await listRemote(), { includeDrafts: true });
}

export async function publishedCatalog(): Promise<ExamPack[]> {
  try {
    return mergeCatalog(await listRemote(), { includeDrafts: false });
  } catch (err) {
    console.error('[exam-packs] read failed', err);
    return mergeCatalog([], { includeDrafts: false });
  }
}

export async function publishedPack(id: string): Promise<ExamPack | null> {
  const packs = await publishedCatalog();
  return packs.find(pack => pack.id === id) ?? null;
}

export function isPackAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}
