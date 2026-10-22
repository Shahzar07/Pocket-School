import { randomBytes } from 'node:crypto';
import { loadUser, type AuthedUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { isSuperAdminEmail } from '@/lib/roles';
import { ActionError } from '@/lib/server/actions';
import { bytesFromBase64, imagePass, readObject, removeObject, saveObject } from '@/lib/server/files';
import { RESULT_COPY } from './copy';
import {
  canVerifyResult,
  isFileMime,
  isResultLevel,
  levelLabel,
  MAX_FILE_BYTES,
  progressBySession,
  resultsPageAllowed,
  statusLabel,
  studentSaveStatus,
  validBoard,
  type ClientResult,
  type DeskView,
  type PublicResult,
  type ResultStatus,
  type SessionProgress,
} from './model';

const RESULTS = 'academicResults';
const PORTFOLIOS = 'resultPortfolios';

interface Actor {
  uid: string;
  email?: string;
  role: string | null;
  roles: string[] | null;
  institutionId: string | null;
  childIds: string[];
}

interface StoredResult {
  id: string;
  studentId: string;
  level: string;
  subject: string;
  board: string;
  grade: string;
  session: string;
  status: ResultStatus;
  storagePath: string | null;
  fileName: string | null;
  mime: string | null;
  createdAt: number;
  updatedAt: number;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asTime(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseStored(id: string, data: Record<string, unknown>): StoredResult {
  const status: ResultStatus = data.status === 'verified' ? 'verified' : 'self-reported';
  return {
    id,
    studentId: asText(data.studentId, 128),
    level: asText(data.level, 40),
    subject: asText(data.subject, 80),
    board: asText(data.board, 80),
    grade: asText(data.grade, 20),
    session: asText(data.session, 40),
    status,
    storagePath: asText(data.storagePath, 240) || null,
    fileName: asText(data.fileName, 80) || null,
    mime: asText(data.mime, 80) || null,
    createdAt: asTime(data.createdAt),
    updatedAt: asTime(data.updatedAt),
  };
}

function toClient(row: StoredResult): ClientResult {
  return {
    id: row.id,
    studentId: row.studentId,
    level: row.level,
    levelLabel: levelLabel(row.level),
    subject: row.subject,
    board: row.board,
    grade: row.grade,
    session: row.session,
    status: row.status,
    statusLabel: statusLabel(row.status),
    fileName: row.fileName,
    hasFile: Boolean(row.storagePath),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPublic(row: StoredResult): PublicResult {
  return {
    levelLabel: levelLabel(row.level),
    subject: row.subject,
    board: row.board,
    grade: row.grade,
    session: row.session,
    statusLabel: statusLabel(row.status),
  };
}

function assertReady(): void {
  if (!isAdminConfigured()) throw new ActionError('SETUP_NEEDED', RESULT_COPY.setup);
}

async function actorFrom(user: AuthedUser): Promise<Actor> {
  assertReady();
  const profile = await loadUser(user.uid);
  const role = profile
    ? (typeof profile.role === 'string' ? profile.role : null)
    : (user.role ?? null);
  const roles = Array.isArray(profile?.roles)
    ? profile.roles.filter((item): item is string => typeof item === 'string')
    : null;
  return {
    uid: user.uid,
    email: user.email,
    role,
    roles,
    institutionId: typeof profile?.institutionId === 'string' ? profile.institutionId : null,
    childIds: Array.isArray(profile?.childIds)
      ? profile.childIds.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function isPlatformAdmin(actor: Actor): boolean {
  return actor.role === 'admin' || isSuperAdminEmail(actor.email);
}

function isParent(actor: Actor): boolean {
  return actor.role === 'parent' || (actor.roles ?? []).includes('parent');
}

async function studentInstitution(studentId: string): Promise<string | null> {
  const profile = await loadUser(studentId);
  return typeof profile?.institutionId === 'string' ? profile.institutionId : null;
}

async function assertCanReadStudent(actor: Actor, studentId: string): Promise<void> {
  if (actor.uid === studentId && actor.role === 'student') return;
  if (isParent(actor) && actor.childIds.includes(studentId)) return;
  const allowed = canVerifyResult(actor, { institutionId: await studentInstitution(studentId) });
  if (!allowed) throw new ActionError('FORBIDDEN', RESULT_COPY.notLinked);
}

async function listStored(studentId: string): Promise<StoredResult[]> {
  const snap = await adminDb().collection(RESULTS).where('studentId', '==', studentId).limit(200).get();
  return snap.docs
    .map((doc) => parseStored(doc.id, doc.data() ?? {}))
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function readStored(id: string): Promise<StoredResult> {
  const snap = await adminDb().collection(RESULTS).doc(id).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', RESULT_COPY.empty);
  return parseStored(snap.id, snap.data() ?? {});
}

async function shareState(studentId: string): Promise<{ enabled: boolean; path: string }> {
  const snap = await adminDb().collection(PORTFOLIOS).doc(studentId).get();
  const data = snap.data() ?? {};
  const token = asText(data.token, 80);
  const enabled = data.enabled === true && token.length >= 32;
  return { enabled, path: enabled ? `/results/${token}` : '' };
}

async function childNames(ids: string[]): Promise<{ id: string; name: string }[]> {
  const names = await Promise.all(ids.slice(0, 20).map(async (id) => {
    const profile = await loadUser(id);
    const name = asText(profile?.name, 80) || RESULT_COPY.linkedLearner;
    return { id, name };
  }));
  return names;
}

function deskFrom(role: DeskView['role'], studentId: string, rows: StoredResult[], extra: Partial<DeskView>): DeskView {
  return {
    role,
    studentId,
    rows: rows.map(toClient),
    progress: progressBySession(rows),
    canEdit: false,
    canVerify: false,
    share: null,
    children: [],
    needsStudent: false,
    ...extra,
  };
}

export async function resultsDesk(user: AuthedUser, studentId: string): Promise<DeskView> {
  const actor = await actorFrom(user);
  if (!resultsPageAllowed(actor)) throw new ActionError('FORBIDDEN', RESULT_COPY.forbidden);
  if (isPlatformAdmin(actor)) {
    if (!studentId) return deskFrom('admin', '', [], { canVerify: true, needsStudent: true });
    await assertCanReadStudent(actor, studentId);
    const rows = await listStored(studentId);
    return deskFrom('admin', studentId, rows, { canVerify: true });
  }
  if (actor.role === 'institution_admin') {
    if (!studentId) return deskFrom('institution', '', [], { canVerify: true, needsStudent: true });
    await assertCanReadStudent(actor, studentId);
    const rows = await listStored(studentId);
    return deskFrom('institution', studentId, rows, { canVerify: true });
  }
  if (isParent(actor) && actor.role !== 'student') {
    const children = await childNames(actor.childIds);
    const childId = studentId || (actor.childIds.length === 1 ? actor.childIds[0] ?? '' : '');
    if (!childId) return deskFrom('parent', '', [], { children, needsStudent: true });
    if (!actor.childIds.includes(childId)) throw new ActionError('FORBIDDEN', RESULT_COPY.notLinked);
    const rows = await listStored(childId);
    return deskFrom('parent', childId, rows, { children });
  }
  if (actor.role !== 'student') throw new ActionError('FORBIDDEN', RESULT_COPY.forbidden);
  const rows = await listStored(actor.uid);
  return deskFrom('student', actor.uid, rows, { canEdit: true, share: await shareState(actor.uid) });
}

interface SaveInput {
  id?: string;
  level?: string;
  subject?: string;
  board?: string;
  grade?: string;
  session?: string;
  status?: unknown;
  fileBase64?: string;
  fileName?: string;
  mime?: string;
}

export async function saveResult(user: AuthedUser, input: SaveInput): Promise<ClientResult> {
  const actor = await actorFrom(user);
  if (actor.role !== 'student') throw new ActionError('FORBIDDEN', RESULT_COPY.studentOnly);
  const level = asText(input.level, 40);
  const subject = asText(input.subject, 80);
  const board = asText(input.board, 80);
  const grade = asText(input.grade, 20);
  const session = asText(input.session, 40);
  if (!isResultLevel(level)) throw new ActionError('BAD_REQUEST', RESULT_COPY.levelMissing);
  if (subject.length < 1) throw new ActionError('BAD_REQUEST', RESULT_COPY.subjectMissing);
  if (!validBoard(level, board)) {
    throw new ActionError('BAD_REQUEST', level === 'IGCSE' || level === 'A-Level' ? RESULT_COPY.boardMissing : RESULT_COPY.bodyMissing);
  }
  if (grade.length < 1) throw new ActionError('BAD_REQUEST', RESULT_COPY.gradeMissing);
  if (session.length < 1) throw new ActionError('BAD_REQUEST', RESULT_COPY.sessionMissing);
  const status = studentSaveStatus(input.status);
  const existingId = asText(input.id, 128);
  const ref = existingId
    ? adminDb().collection(RESULTS).doc(existingId)
    : adminDb().collection(RESULTS).doc();
  const previous = existingId ? await readStored(existingId) : null;
  if (previous && previous.studentId !== actor.uid) throw new ActionError('FORBIDDEN', RESULT_COPY.ownOnly);
  let storagePath = previous?.storagePath ?? null;
  let fileName = previous?.fileName ?? null;
  let mime = previous?.mime ?? null;
  const rawFile = typeof input.fileBase64 === 'string' ? input.fileBase64.trim() : '';
  if (rawFile.length > 4_000_000) throw new ActionError('BAD_REQUEST', RESULT_COPY.fileLarge);
  if (rawFile) {
    const declared = asText(input.mime, 80);
    if (!isFileMime(declared)) throw new ActionError('BAD_REQUEST', RESULT_COPY.fileType);
    const decoded = bytesFromBase64(rawFile);
    if (!decoded || decoded.length > MAX_FILE_BYTES) throw new ActionError('BAD_REQUEST', RESULT_COPY.fileLarge);
    const bytes = declared.startsWith('image/') ? await imagePass(decoded, declared) : decoded;
    if (bytes.length > MAX_FILE_BYTES) throw new ActionError('BAD_REQUEST', RESULT_COPY.fileLarge);
    storagePath = `results/${actor.uid}/${ref.id}`;
    fileName = asText(input.fileName, 80) || 'certificate';
    mime = declared;
    await saveObject(storagePath, bytes, mime);
  }
  const now = Date.now();
  const record = {
    studentId: actor.uid,
    level,
    subject,
    board,
    grade,
    session,
    status,
    storagePath,
    fileName,
    mime,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(record);
  return toClient(parseStored(ref.id, record));
}

export async function removeResult(user: AuthedUser, id: string): Promise<{ ok: true }> {
  const actor = await actorFrom(user);
  if (actor.role !== 'student') throw new ActionError('FORBIDDEN', RESULT_COPY.studentOnly);
  const row = await readStored(id);
  if (row.studentId !== actor.uid) throw new ActionError('FORBIDDEN', RESULT_COPY.ownOnly);
  if (row.status === 'verified') throw new ActionError('FORBIDDEN', RESULT_COPY.verifiedStays);
  if (row.storagePath) await removeObject(row.storagePath);
  await adminDb().collection(RESULTS).doc(id).delete();
  return { ok: true };
}

export async function verifyResult(user: AuthedUser, id: string): Promise<ClientResult> {
  const actor = await actorFrom(user);
  const row = await readStored(id);
  const allowed = canVerifyResult(actor, { institutionId: await studentInstitution(row.studentId) });
  if (!allowed) throw new ActionError('FORBIDDEN', RESULT_COPY.cannotVerify);
  const now = Date.now();
  await adminDb().collection(RESULTS).doc(id).set({
    status: 'verified',
    verifiedBy: actor.uid,
    verifiedAt: now,
    updatedAt: now,
  }, { merge: true });
  return toClient({ ...row, status: 'verified', updatedAt: now });
}

export async function setResultShare(user: AuthedUser, enabled: boolean): Promise<{ enabled: boolean; path: string }> {
  const actor = await actorFrom(user);
  if (actor.role !== 'student') throw new ActionError('FORBIDDEN', RESULT_COPY.studentOnly);
  const ref = adminDb().collection(PORTFOLIOS).doc(actor.uid);
  const existing = await ref.get();
  const current = asText(existing.data()?.token, 80);
  const token = current.length >= 32 ? current : randomBytes(18).toString('hex');
  await ref.set({ enabled, token, updatedAt: Date.now() }, { merge: true });
  return { enabled, path: enabled ? `/results/${token}` : '' };
}

export async function publicPortfolio(token: string): Promise<{ state: 'private' | 'open'; rows: PublicResult[]; progress: SessionProgress[] }> {
  const clean = token.trim().toLowerCase();
  if (!isAdminConfigured() || !/^[a-f0-9]{32,64}$/.test(clean)) {
    return { state: 'private', rows: [], progress: [] };
  }
  try {
    const snap = await adminDb().collection(PORTFOLIOS).where('token', '==', clean).limit(5).get();
    const open = snap.docs.find((doc) => doc.data().enabled === true);
    if (!open) return { state: 'private', rows: [], progress: [] };
    const rows = await listStored(open.id);
    return { state: 'open', rows: rows.map(toPublic), progress: progressBySession(rows) };
  } catch (error) {
    console.error(error);
    return { state: 'private', rows: [], progress: [] };
  }
}

export async function readResultFile(user: AuthedUser, id: string): Promise<{ bytes: Buffer; mime: string; fileName: string }> {
  const actor = await actorFrom(user);
  const row = await readStored(id);
  await assertCanReadStudent(actor, row.studentId);
  if (!row.storagePath || !row.mime || !isFileMime(row.mime)) throw new ActionError('NOT_FOUND', RESULT_COPY.fileFailed);
  const bytes = await readObject(row.storagePath);
  return { bytes, mime: row.mime, fileName: row.fileName || 'certificate' };
}
