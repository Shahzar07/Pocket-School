'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SavedExam {
  level: string;
  board: string;
  subject: string;
  packId?: string;
  name?: string;
}

export async function readSavedExams(uid: string): Promise<SavedExam[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'pack_progress', 'my-exams'));
  const rows = snap.data()?.exams;
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row.subject === 'string') : [];
}

export async function rememberExam(uid: string, exam: SavedExam): Promise<void> {
  const current = await readSavedExams(uid);
  const key = `${exam.level}|${exam.board}|${exam.subject}|${exam.packId ?? ''}`;
  const next = [exam, ...current.filter((row) => `${row.level}|${row.board}|${row.subject}|${row.packId ?? ''}` !== key)].slice(0, 8);
  await setDoc(doc(db, 'users', uid, 'pack_progress', 'my-exams'), { exams: next, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveExamDate(uid: string, packId: string, examDate: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'pack_progress', packId), { examDate, updatedAt: serverTimestamp() }, { merge: true });
}

export async function readExamDate(uid: string, packId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'users', uid, 'pack_progress', packId));
  const value = snap.data()?.examDate;
  return typeof value === 'string' ? value : '';
}

export async function saveReadiness(uid: string, packId: string, patch: { academicResult?: string; sharedAt?: number }): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'pack_progress', packId), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
