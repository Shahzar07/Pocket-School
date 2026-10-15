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

export async function saveMood(studentId: string, dateKey: string, mood: number, effort?: number) {
  await setDoc(doc(db, 'mood_checkins', `${studentId}_${dateKey}`), omitUndefined({
    studentId, dateKey, mood, effort, updatedAt: serverTimestamp(),
  }), { merge: true });
}

export async function listMoods(studentId: string) {
  const snap = await getDocs(query(collection(db, 'mood_checkins'), where('studentId', '==', studentId)));
  return snap.docs.map(row => {
    const data = row.data();
    return {
      dateKey: String(data.dateKey ?? ''),
      mood: Number(data.mood) as 1 | 2 | 3 | 4 | 5,
      effort: typeof data.effort === 'number' ? data.effort : undefined,
      at: String(data.updatedAt?.toDate?.()?.toISOString?.() ?? `${data.dateKey}T12:00:00.000Z`),
    };
  });
}

export async function listStudyEvents(studentId: string) {
  const snap = await getDocs(query(collection(db, 'study_events'), where('studentId', '==', studentId)));
  return snap.docs.map(row => row.data() as { minutes?: number; at?: string; weekday?: number; hour?: number; courseId?: string });
}

export async function listFocusSessions(studentId: string) {
  const snap = await getDocs(query(collection(db, 'focus_sessions'), where('studentId', '==', studentId)));
  return snap.docs.map(row => {
    const data = row.data();
    return {
      plannedMinutes: Number(data.plannedMinutes) || 0,
      actualMinutes: Number(data.actualMinutes) || 0,
      at: typeof data.startedAt?.toDate === 'function' ? data.startedAt.toDate().toISOString() : undefined,
      goalId: data.goalId as string | undefined,
    };
  });
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

export async function saveConcernFlag(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, 'concern_flags'), omitUndefined({
    ...data,
    automaticPenalty: false,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function listConcernFlags(field: 'studentId' | 'teacherId', id: string) {
  const snap = await getDocs(query(collection(db, 'concern_flags'), where(field, '==', id)));
  return snap.docs.map(row => ({ id: row.id, ...row.data() } as Record<string, unknown> & { id: string }));
}

export async function saveReexamResponse(data: { caseId: string; studentId: string; teacherId: string; answers: string; vivaAnswers?: string }) {
  const ref = await addDoc(collection(db, 'reexam_responses'), omitUndefined({
    ...data,
    automaticPenalty: false,
    submittedAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function saveNotifySettings(userId: string, settings: { quietStart: string; quietEnd: string; institutionId?: string }) {
  await setDoc(doc(db, 'notify_settings', userId), omitUndefined(settings), { merge: true });
}

export async function saveSchoolTemplate(id: string, template: {
  institutionId: string;
  label: string;
  heading: string;
  scaleId: string;
  logoUrl: string;
}) {
  await setDoc(doc(db, 'report_templates', id), template, { merge: true });
}

export async function listSchoolTemplates(institutionId: string) {
  const snap = await getDocs(query(collection(db, 'report_templates'), where('institutionId', '==', institutionId)));
  return snap.docs.map(row => ({ id: row.id, ...row.data() } as Record<string, unknown> & { id: string }));
}

export async function readPublishedReport(token: string) {
  const snap = await getDoc(doc(db, 'published_reports', token));
  return snap.exists() ? snap.data() : null;
}
