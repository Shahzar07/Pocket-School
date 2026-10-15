'use client';

/**
 * Firestore access for the study tools. Everything lives under the student's
 * own user document, so the rules can be a simple ownership check and a
 * parent's or teacher's access can be granted explicitly.
 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, updateDoc, increment, runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { assertDailySparksLimit } from '@/lib/db';
import { STUDY_COSTS, type StudyCostKey } from '@/lib/sparks';
import type { ExamAttempt, ExamPrep, MathSession, StudyAsset } from './types';
import { isoDay, nextStreak } from './schedule';
import { useAuthSTORE } from '@/hooks/use-auth';

/* Firestore rejects undefined anywhere in a document; strip it. */
export function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (x === undefined ? null : x)));
}

const prepsCol = (uid: string) => collection(db, 'users', uid, 'exam_preps');
const prepDoc = (uid: string, id: string) => doc(db, 'users', uid, 'exam_preps', id);

/* ── Sparks ───────────────────────────────────────────────────── */

export class InsufficientSparks extends Error {
  constructor(public needed: number, public balance: number) {
    super(`This needs ${needed} Sparks and you have ${balance}.`);
  }
}

/** Throw before doing expensive work if the student can't afford it. */
export async function assertSparks(uid: string, key: StudyCostKey, multiplier = 1): Promise<number> {
  const cost = STUDY_COSTS[key] * multiplier;
  if (cost <= 0) return 0;
  await assertDailySparksLimit(uid, cost);
  const snap = await getDoc(doc(db, 'users', uid));
  const balance = (snap.data()?.sparksBalance as number) ?? 0;
  if (balance < cost) throw new InsufficientSparks(cost, balance);
  return cost;
}

/** Deduct after success, with a ledger entry. Returns the new balance. */
export async function chargeSparks(uid: string, key: StudyCostKey, note: string, multiplier = 1): Promise<number | null> {
  const cost = STUDY_COSTS[key] * multiplier;
  if (cost <= 0) return null;
  await assertDailySparksLimit(uid, cost);
  const userRef = doc(db, 'users', uid);
  const txRef = doc(collection(db, 'users', uid, 'spark_transactions'));
  const after = await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    const balance = (snap.data()?.sparksBalance as number) ?? 0;
    const next = Math.max(0, balance - cost);
    tx.update(userRef, { sparksBalance: next, updatedAt: serverTimestamp() });
    tx.set(txRef, { amount: -cost, type: 'study', format: key, note, balanceAfter: next, createdAt: serverTimestamp() });
    return next;
  });
  // Keep the header's Sparks counter in step without a reload.
  const { profile, setProfile } = useAuthSTORE.getState();
  if (profile) setProfile({ ...profile, sparksBalance: after });
  return after;
}

/* ── Exam preps ───────────────────────────────────────────────── */

export async function listPreps(uid: string): Promise<ExamPrep[]> {
  const snap = await getDocs(query(prepsCol(uid), orderBy('updatedAt', 'desc'), limit(50)));
  return snap.docs.map(d => ({ ...(d.data() as ExamPrep), id: d.id }));
}

export async function getPrep(uid: string, id: string): Promise<ExamPrep | null> {
  const snap = await getDoc(prepDoc(uid, id));
  return snap.exists() ? { ...(snap.data() as ExamPrep), id: snap.id } : null;
}

export async function createPrep(uid: string, prep: Omit<ExamPrep, 'id' | 'createdAt' | 'updatedAt'>, material: string): Promise<string> {
  // clean() must run before the timestamps are added — it can't carry them.
  const ref = await addDoc(prepsCol(uid), { ...clean(prep), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await setDoc(doc(db, 'users', uid, 'exam_preps', ref.id, 'material', 'main'), { text: material.slice(0, 200_000) });
  return ref.id;
}

export async function updatePrep(uid: string, id: string, patch: Partial<ExamPrep>) {
  await updateDoc(prepDoc(uid, id), { ...clean(patch), updatedAt: serverTimestamp() });
}

export async function deletePrep(uid: string, id: string) {
  // Subcollections aren't removed with the parent; clear the ones we own.
  for (const sub of ['assets', 'attempts', 'material']) {
    const snap = await getDocs(collection(db, 'users', uid, 'exam_preps', id, sub));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(prepDoc(uid, id));
}

export async function getMaterial(uid: string, id: string): Promise<string> {
  const snap = await getDoc(doc(db, 'users', uid, 'exam_preps', id, 'material', 'main'));
  return (snap.data()?.text as string) ?? '';
}

/* ── Cached assets ────────────────────────────────────────────── */

export const assetId = (topicId: string, type: string, variant = 'default') => `${topicId}__${type}__${variant}`;

export async function getAsset<T>(uid: string, prepId: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'exam_preps', prepId, 'assets', id));
  return snap.exists() ? ((snap.data() as StudyAsset).data as T) : null;
}

export async function saveAsset(uid: string, prepId: string, id: string, asset: Omit<StudyAsset, 'createdAt'>) {
  await setDoc(doc(db, 'users', uid, 'exam_preps', prepId, 'assets', id), { ...clean(asset), createdAt: serverTimestamp() });
}

/* ── Progress ─────────────────────────────────────────────────── */

/**
 * Blend a new result into a topic's mastery. Recent evidence counts more,
 * but one bad quiz doesn't erase a week of work.
 */
export function blendMastery(current: number | undefined, score: number, weight = 0.45): number {
  const c = current ?? 0;
  return Math.round(Math.min(100, Math.max(0, c * (1 - weight) + score * weight)));
}

/** Mark a plan item done, update mastery, streak and the student's stars. */
export async function completeItem(
  uid: string,
  prep: ExamPrep,
  itemId: string,
  result?: { topicId: string; score: number; weight?: number },
): Promise<Partial<ExamPrep>> {
  const today = isoDay();
  const patch: Partial<ExamPrep> = {
    completed: { ...prep.completed, [itemId]: true },
    streak: nextStreak(prep.streak ?? 0, prep.lastStudyDay, today),
    lastStudyDay: today,
    studyDays: Array.from(new Set([...(prep.studyDays ?? []), today])).slice(-120),
  };
  if (result) {
    patch.mastery = { ...prep.mastery, [result.topicId]: blendMastery(prep.mastery?.[result.topicId], result.score, result.weight) };
  }
  await updatePrep(uid, prep.id, patch);
  await recordStudyDay(uid, 2);
  return patch;
}

/** Global streak and stars on the user profile, shared by every study tool. */
export async function recordStudyDay(uid: string, stars = 0) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const d = snap.data() ?? {};
  const today = isoDay();
  await updateDoc(ref, {
    studyStreak: nextStreak((d.studyStreak as number) ?? 0, d.studyLastDay as string | undefined, today),
    studyLastDay: today,
    ...(stars ? { stars: increment(stars) } : {}),
  });
}

/* ── Attempts ─────────────────────────────────────────────────── */

export async function saveAttempt(uid: string, prepId: string, attempt: ExamAttempt): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'exam_preps', prepId, 'attempts'), { ...clean(attempt), createdAt: serverTimestamp() });
  return ref.id;
}

export async function listAttempts(uid: string, prepId: string): Promise<ExamAttempt[]> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'exam_preps', prepId, 'attempts'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs.map(d => ({ ...(d.data() as ExamAttempt), id: d.id }));
}

/* ── Sharing ──────────────────────────────────────────────────── */

/**
 * Publish a prep's topics and material so classmates can start their own copy.
 * Progress is never shared — only the plan's content.
 */
export async function sharePrep(uid: string, ownerName: string, prep: ExamPrep): Promise<string> {
  if (prep.shareId) return prep.shareId;
  const material = await getMaterial(uid, prep.id);
  const ref = await addDoc(collection(db, 'shared_preps'), { createdAt: serverTimestamp(), ...clean({
    ownerId: uid,
    ownerName,
    title: prep.title,
    subject: prep.subject,
    level: prep.level,
    gradeScale: prep.gradeScale,
    language: prep.language,
    topics: prep.topics,
    sourceNames: prep.sourceNames,
    material: material.slice(0, 200_000),
  }) });
  await updatePrep(uid, prep.id, { shareId: ref.id });
  return ref.id;
}

export interface SharedPrep {
  id: string; ownerId: string; ownerName: string; title: string; subject: string; level: string;
  gradeScale: ExamPrep['gradeScale']; language: string; topics: ExamPrep['topics']; sourceNames: string[]; material: string;
}

export async function getSharedPrep(id: string): Promise<SharedPrep | null> {
  const snap = await getDoc(doc(db, 'shared_preps', id));
  return snap.exists() ? ({ ...(snap.data() as SharedPrep), id: snap.id }) : null;
}

/* ── Maths sessions ───────────────────────────────────────────── */

const mathCol = (uid: string) => collection(db, 'users', uid, 'math_sessions');

export async function saveMathSession(uid: string, session: MathSession): Promise<string> {
  const { id, ...rest } = session;
  if (id) {
    await setDoc(doc(mathCol(uid), id), { ...clean(rest), updatedAt: serverTimestamp() }, { merge: true });
    return id;
  }
  const ref = await addDoc(mathCol(uid), { ...clean(rest), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function listMathSessions(uid: string, n = 30): Promise<MathSession[]> {
  const snap = await getDocs(query(mathCol(uid), orderBy('updatedAt', 'desc'), limit(n)));
  return snap.docs.map(d => ({ ...(d.data() as MathSession), id: d.id }));
}

export async function deleteMathSession(uid: string, id: string) {
  await deleteDoc(doc(mathCol(uid), id));
}

export { STUDY_COSTS };

/* ── Official exam packs ──────────────────────────────────────── */

export interface PackProgress { mastery: Record<string, number>; setsDone: number; lastTopic?: string }

export async function getPackProgress(uid: string, packId: string): Promise<PackProgress> {
  const snap = await getDoc(doc(db, 'users', uid, 'pack_progress', packId));
  const d = snap.data() as Partial<PackProgress> | undefined;
  return { mastery: d?.mastery ?? {}, setsDone: d?.setsDone ?? 0, lastTopic: d?.lastTopic };
}

export async function savePackProgress(uid: string, packId: string, p: PackProgress) {
  await setDoc(doc(db, 'users', uid, 'pack_progress', packId), { ...clean(p), updatedAt: serverTimestamp() }, { merge: true });
}

export async function getPackSet<T>(uid: string, packId: string, key: string): Promise<T | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'pack_progress', packId, 'sets', key));
  return snap.exists() ? (snap.data().questions as T) : null;
}

export async function savePackSet(uid: string, packId: string, key: string, questions: unknown) {
  await setDoc(doc(db, 'users', uid, 'pack_progress', packId, 'sets', key), { questions: clean(questions), createdAt: serverTimestamp() });
}
