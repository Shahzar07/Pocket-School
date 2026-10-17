/**
 * Client writes for self-join. Decisions live in lib/institution-membership.ts.
 */

import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { allocateSparks, buildSparkPool, type SparkAllocation, type SparkPool } from './institution-membership';
import { db } from './firebase';
import { draftJoinRequest, institutionsForSelfJoin, inviteCodeUsable, reviewJoin, type JoinDirectoryRow, type JoinRole } from './institution-membership';
import type { VolumePlanId } from './institution-pricing';

function rowFrom(id: string, data: Record<string, unknown>): JoinDirectoryRow {
  const phase = data.billingPhase;
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Institution',
    country: typeof data.country === 'string' ? data.country : '',
    state: typeof data.state === 'string' ? data.state : '',
    status: typeof data.status === 'string' ? data.status : '',
    listedForSelfJoin: data.listedForSelfJoin === true,
    billingPhase: phase === 'pending_payment' || phase === 'active' || phase === 'grace' || phase === 'suspended' || phase === '' ? phase : undefined,
  };
}

export async function listSelfJoinInstitutions(country: string, state: string): Promise<JoinDirectoryRow[]> {
  const snap = await getDocs(query(collection(db, 'institutions'), where('listedForSelfJoin', '==', true)));
  const rows = snap.docs.map((item) => rowFrom(item.id, item.data() as Record<string, unknown>));
  return institutionsForSelfJoin(rows, country, state);
}

export async function submitSelfJoin(input: {
  userId: string;
  institutionId: string;
  role: JoinRole;
  name: string;
  email: string;
  childEmails?: readonly string[];
}): Promise<void> {
  const draft = draftJoinRequest(input);
  if ('error' in draft) throw new Error(draft.error);
  await setDoc(doc(db, 'institutions', input.institutionId, 'join_requests', input.userId), {
    userId: draft.userId,
    role: draft.role,
    email: draft.email,
    name: draft.name,
    status: 'pending',
    childEmails: draft.childEmails,
    createdAt: new Date().toISOString(),
  });
}

export async function redeemInviteCode(input: {
  userId: string;
  email: string;
  code: string;
  role: JoinRole;
  name: string;
  childEmails?: readonly string[];
}): Promise<'joined' | 'requested'> {
  const code = input.code.trim().toUpperCase();
  const snap = await getDoc(doc(db, 'join_codes', code));
  if (!snap.exists()) throw new Error('That join code is not recognised.');
  const data = snap.data() as { institutionId?: string };
  const institutionId = data.institutionId ?? '';
  const academy = institutionId ? await getDoc(doc(db, 'institutions', institutionId)) : null;
  const status = academy?.exists() ? String(academy.data()?.status ?? '') : '';
  if (!inviteCodeUsable(code, status)) throw new Error('That join code is not active.');
  const invite = await getDoc(doc(db, 'institutions', institutionId, 'invites', input.email.trim().toLowerCase()));
  if (invite.exists()) {
    await updateDoc(doc(db, 'users', input.userId), { institutionId });
    return 'joined';
  }
  await submitSelfJoin({ ...input, institutionId });
  return 'requested';
}

export interface StoredJoinRequest {
  id: string;
  userId: string;
  role: JoinRole;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  level: VolumePlanId | '';
  classIds: string[];
  courseIds: string[];
  childEmails: string[];
}

export async function listJoinRequests(institutionId: string): Promise<StoredJoinRequest[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'join_requests'));
  return snap.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const role = data.role === 'teacher' || data.role === 'parent' ? data.role : 'student';
    const status = data.status === 'approved' || data.status === 'rejected' ? data.status : 'pending';
    const level = data.level === 'primary_secondary' || data.level === 'igcse_alevel' || data.level === 'professional' ? data.level : '';
    return {
      id: item.id,
      userId: typeof data.userId === 'string' ? data.userId : item.id,
      role,
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : '',
      status,
      level,
      classIds: Array.isArray(data.classIds) ? data.classIds.filter((id): id is string => typeof id === 'string') : [],
      courseIds: Array.isArray(data.courseIds) ? data.courseIds.filter((id): id is string => typeof id === 'string') : [],
      childEmails: Array.isArray(data.childEmails) ? data.childEmails.filter((id): id is string => typeof id === 'string') : [],
    };
  });
}

export async function decideJoinRequest(input: {
  institutionId: string;
  request: StoredJoinRequest;
  decision: 'approved' | 'rejected';
  level: VolumePlanId | '';
  classIds: string[];
  courseIds: string[];
  actorId: string;
}): Promise<void> {
  const reviewed = reviewJoin({
    userId: input.request.userId,
    institutionId: input.institutionId,
    role: input.request.role,
    name: input.request.name,
    email: input.request.email,
    status: input.request.status,
    level: input.request.level,
    classIds: input.request.classIds,
    courseIds: input.request.courseIds,
    childEmails: input.request.childEmails,
  }, { status: input.decision, level: input.level, classIds: input.classIds, courseIds: input.courseIds });
  if ('error' in reviewed) throw new Error(reviewed.error);
  await updateDoc(doc(db, 'institutions', input.institutionId, 'join_requests', input.request.userId), {
    status: reviewed.status,
    level: reviewed.level,
    classIds: reviewed.classIds,
    courseIds: reviewed.courseIds,
    decidedBy: input.actorId,
    decidedAt: new Date().toISOString(),
  });
  if (reviewed.status === 'approved') {
    await updateDoc(doc(db, 'users', reviewed.userId), {
      institutionId: input.institutionId,
      level: reviewed.level,
      cohortIds: reviewed.classIds,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function loadSparkPool(institutionId: string, seats: number, perSeat: number): Promise<SparkPool> {
  const snap = await getDoc(doc(db, 'institutions', institutionId, 'sparks_pool', 'current'));
  const data = snap.exists() ? snap.data() as { topUps?: number; allocated?: number } : {};
  const built = buildSparkPool({
    planId: 'igcse_alevel',
    seats,
    perSeat,
    topUps: typeof data.topUps === 'number' ? data.topUps : 0,
    allocated: typeof data.allocated === 'number' ? data.allocated : 0,
  });
  if ('error' in built) throw new Error(built.error);
  return built;
}

export async function saveSparkAllocation(institutionId: string, pool: SparkPool, current: readonly SparkAllocation[], next: SparkAllocation): Promise<SparkAllocation[]> {
  const result = allocateSparks(pool, current, next);
  if ('error' in result) throw new Error(result.error);
  await setDoc(doc(db, 'institutions', institutionId, 'sparks_allocations', next.subjectId), {
    subjectId: next.subjectId,
    amount: next.amount,
    classId: next.classId,
    note: '',
    at: new Date().toISOString().slice(0, 10),
  });
  return result.allocations;
}

export async function readSparkGuard(institutionId: string): Promise<{ cap: number | null; lowAtPercent: number }> {
  const snap = await getDoc(doc(db, 'institutions', institutionId, 'sparks_guard', 'current'));
  const data = snap.exists() ? snap.data() as { cap?: number; lowAtPercent?: number } : {};
  return {
    cap: typeof data.cap === 'number' ? data.cap : null,
    lowAtPercent: typeof data.lowAtPercent === 'number' ? data.lowAtPercent : 20,
  };
}

export async function saveSparkGuard(institutionId: string, cap: number, lowAtPercent: number): Promise<void> {
  await setDoc(doc(db, 'institutions', institutionId, 'sparks_guard', 'current'), { cap, lowAtPercent });
}

export async function approveInstitutionCourse(courseId: string, actorId: string, approved: boolean): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), {
    libraryApproved: approved,
    libraryNote: approved ? 'In the library' : 'Returned to the teacher',
    libraryDecidedBy: actorId,
    libraryDecidedAt: new Date().toISOString(),
  });
}
