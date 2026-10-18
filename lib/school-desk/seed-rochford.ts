import { isAdminConfigured, adminDb } from '../firebase-admin';
import { createDemoDesk } from './model';

/** Writes the Rochford fixture only when its class document is missing. */
export async function seedRochfordClassIfMissing(): Promise<{ written: boolean; name: string }> {
  if (!isAdminConfigured()) {
    throw new Error('missing-admin');
  }
  const desk = createDemoDesk();
  const klass = desk.classes[0];
  if (!klass) return { written: false, name: '' };
  const db = adminDb();
  const ref = db.collection('school_classes').doc(klass.id);
  const existing = await ref.get();
  if (existing.exists) return { written: false, name: klass.name };
  const batch = db.batch();
  const scale = { defaultScale: desk.institution.defaultScale, customBands: desk.institution.customBands };
  batch.set(ref, { ...klass, gradeScale: scale });
  for (const row of desk.enrolments) {
    batch.set(db.collection('school_enrolments').doc(row.id), {
      ...row,
      ownerTeacherId: klass.ownerTeacherId,
      institutionId: klass.institutionId,
      className: klass.name,
    });
  }
  for (const row of desk.assessments) {
    batch.set(db.collection('school_assessments').doc(row.id), {
      ...row,
      ownerTeacherId: klass.ownerTeacherId,
      institutionId: klass.institutionId,
      className: klass.name,
    });
  }
  for (const row of desk.marks) {
    const assessment = desk.assessments.find((item) => item.id === row.assessmentId);
    const student = desk.enrolments.find((item) => item.studentId === row.studentId);
    batch.set(db.collection('school_marks').doc(row.id), {
      ...row,
      ownerTeacherId: klass.ownerTeacherId,
      institutionId: klass.institutionId,
      className: klass.name,
      assessmentTitle: assessment?.title ?? '',
      scaleId: assessment?.scaleId ?? desk.institution.defaultScale,
      maxPoints: assessment?.maxPoints ?? 0,
      studentName: student?.studentName ?? '',
    });
  }
  for (const row of desk.attendance) {
    batch.set(db.collection('school_attendance').doc(row.id), {
      ...row,
      ownerTeacherId: klass.ownerTeacherId,
      institutionId: klass.institutionId,
    });
  }
  for (const row of desk.goals) {
    batch.set(db.collection('users').doc(row.studentId).collection('goals').doc(row.id), {
      ...row,
      institutionId: klass.institutionId,
    });
  }
  await batch.commit();
  return { written: true, name: klass.name };
}
