import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { omitUndefined } from '../firestore-sanitize';
import type { Acknowledgement } from './report-cards';

export async function logFocusSession(data: {
  studentId: string;
  goalId: string;
  plannedMinutes: number;
  actualMinutes: number;
  courseId?: string;
}) {
  await addDoc(collection(db, 'focus_sessions'), omitUndefined({
    ...data,
    startedAt: serverTimestamp(),
  }));
}

export async function logStudyEvent(data: {
  studentId: string;
  minutes: number;
  at: string;
  weekday: number;
  hour: number;
  source: 'focus' | 'lesson' | 'quiz';
  courseId?: string;
  goalId?: string;
}) {
  await addDoc(collection(db, 'study_events'), omitUndefined(data));
}

export async function saveMood(studentId: string, dateKey: string, mood: number) {
  await setDoc(doc(db, 'mood_checkins', `${studentId}_${dateKey}`), {
    studentId, dateKey, mood, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function listSuggestions(studentId: string) {
  const snap = await getDocs(query(collection(db, 'goal_suggestions'), where('studentId', '==', studentId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; title: string; status: string; parentId?: string }));
}

export async function createSuggestion(data: { studentId: string; parentId: string; title: string; parentName?: string }) {
  const ref = await addDoc(collection(db, 'goal_suggestions'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setSuggestionStatus(id: string, status: 'accepted' | 'declined') {
  await updateDoc(doc(db, 'goal_suggestions', id), { status });
}

export async function readSnapshot(studentId: string) {
  const snap = await getDoc(doc(db, 'analytics_snapshots', `student_${studentId}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveIntegrityCase(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, 'integrity_cases'), omitUndefined({
    ...data,
    automaticPenalty: false,
    createdAt: serverTimestamp(),
  }));
  await setDoc(doc(db, 'integrity_cases', ref.id, 'audit', 'opened'), {
    at: new Date().toISOString(),
    actorId: data.teacherId,
    actorName: data.teacherName ?? 'Teacher',
    action: 'opened',
  });
  return ref.id;
}

export async function listIntegrityCases(field: 'studentId' | 'teacherId', id: string) {
  const snap = await getDocs(query(collection(db, 'integrity_cases'), where(field, '==', id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));
}

export async function updateIntegrityCase(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, 'integrity_cases', id), omitUndefined(data));
}

export async function appendIntegrityAudit(caseId: string, entry: { actorId: string; actorName: string; action: string; note?: string }) {
  await addDoc(collection(db, 'integrity_cases', caseId, 'audit'), {
    ...omitUndefined(entry),
    at: new Date().toISOString(),
  });
}

export async function saveReportCard(id: string, card: Record<string, unknown>, published: Record<string, unknown>) {
  await setDoc(doc(db, 'report_cards', id), omitUndefined({ ...card, updatedAt: serverTimestamp() }));
  await setDoc(doc(db, 'published_reports', String(published.verificationToken)), published);
}

export async function acknowledgeReport(id: string, acknowledgement: Acknowledgement) {
  await updateDoc(doc(db, 'report_cards', id), { acknowledgement });
}

export async function listReportCards(field: 'studentId' | 'teacherId', id: string) {
  const snap = await getDocs(query(collection(db, 'report_cards'), where(field, '==', id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));
}

export async function saveSchedule(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, 'report_schedules'), omitUndefined({ ...data, createdAt: serverTimestamp() }));
  return ref.id;
}

export async function submitAbsenceNote(note: { studentId: string; parentId: string; dateKey: string; reason: string; courseId?: string }) {
  const ref = await addDoc(collection(db, 'absence_notes'), {
    ...omitUndefined(note),
    status: 'submitted',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function logReportExport(entry: {
  actorId: string;
  role: string;
  format: 'csv' | 'xlsx' | 'pdf';
  metricIds: string[];
  scopeId: string;
  at: string;
}) {
  const ref = await addDoc(collection(db, 'report_exports'), entry);
  return ref.id;
}

export async function readPublishedReport(token: string) {
  const snap = await getDoc(doc(db, 'published_reports', token));
  return snap.exists() ? snap.data() : null;
}
