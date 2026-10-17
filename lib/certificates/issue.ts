import 'server-only';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../firebase-admin';
import {
  CERTIFICATE_ISSUER_ID,
  CERTIFICATE_ISSUER_NAME,
  absoluteVerifyUrl,
  type CertificateAward,
  certificateKey,
  certificateStudentName,
} from '../certificates';
import { issuerFromInstitution } from '../server/module-certificates';
import { attachOpenBadge } from '../server/badge-issue';
import {
  allUnitsPassed,
  certificateEligible,
  certificateLevelName,
  courseCertificatePassMark,
  isFinalAssessment,
  type UnitPassState,
} from './eligibility';
import { emailCertificatePdfLink } from './notify';

function db(): Firestore {
  return adminDb();
}

interface LessonRow {
  id: string;
  moduleId: string;
  data: FirebaseFirestore.DocumentData;
}

function isUnitTest(data: FirebaseFirestore.DocumentData): boolean {
  return data.lessonType === 'unit_test' || data.isUnitQuiz === true;
}

async function courseLessons(courseId: string): Promise<{ units: UnitPassState[]; lessons: LessonRow[] }> {
  const modules = await db().collection(`courses/${courseId}/modules`).orderBy('order').get();
  const lessons: LessonRow[] = [];
  for (const mod of modules.docs) {
    const rows = await db().collection(`courses/${courseId}/modules/${mod.id}/lessons`).orderBy('order').get();
    for (const row of rows.docs) {
      lessons.push({ id: row.id, moduleId: mod.id, data: row.data() });
    }
  }
  const units = modules.docs.map((mod) => ({
    id: mod.id,
    hasUnitTest: lessons.some((lesson) => lesson.moduleId === mod.id && isUnitTest(lesson.data)),
  }));
  return { units, lessons };
}

async function attemptsFor(studentId: string, lessonId: string): Promise<FirebaseFirestore.DocumentData[]> {
  const snap = await db().collection('unit_quiz_attempts')
    .where('studentId', '==', studentId)
    .where('lessonId', '==', lessonId)
    .get();
  return snap.docs.map((doc) => doc.data());
}

/** Certificate fields returned by the mark API. `verifyUrl` and `qr` stay paths. */
export interface CourseCertificateResponse extends CertificateAward {
  name: string;
  course: string;
  level: string;
  score: number;
  verifyUrl: string;
  qr: string;
  absoluteVerifyUrl: string;
  studentNumber?: string;
}

/**
 * Writes one course certificate when the final assessment and every unit are passed.
 * Returns null when the student has not earned it, or already holds it.
 * Completion of lessons never reaches this function.
 */
export async function issueCourseCertificate(studentId: string, courseId: string): Promise<CourseCertificateResponse | null> {
  const courseSnap = await db().doc(`courses/${courseId}`).get();
  if (!courseSnap.exists) return null;
  const course = courseSnap.data() ?? {};
  const userSnap = await db().doc(`users/${studentId}`).get();
  if (!userSnap.exists) return null;
  const { units, lessons } = await courseLessons(courseId);
  const finals = lessons.filter((lesson) => isFinalAssessment(lesson.data));
  if (finals.length === 0) return null;

  const passMark = courseCertificatePassMark(course as { unitTestPassMark?: number });
  const passedUnitIds: string[] = [];
  for (const unit of units) {
    if (!unit.hasUnitTest) continue;
    const papers = lessons.filter((lesson) => lesson.moduleId === unit.id && isUnitTest(lesson.data));
    let passed = false;
    for (const paper of papers) {
      const attempts = await attemptsFor(studentId, paper.id);
      if (attempts.some((attempt) => attempt.passed === true)) {
        passed = true;
        break;
      }
    }
    if (passed) passedUnitIds.push(unit.id);
  }

  let finalScore = 0;
  let finalPassed = false;
  for (const paper of finals) {
    const attempts = await attemptsFor(studentId, paper.id);
    for (const attempt of attempts) {
      const percentage = typeof attempt.percentage === 'number' ? attempt.percentage : 0;
      if (percentage >= passMark && percentage >= finalScore) {
        finalScore = percentage;
        finalPassed = true;
      }
    }
  }
  if (!certificateEligible({ finalPassed, finalScore, passMark, units, passedUnitIds }) || !allUnitsPassed(units, passedUnitIds)) {
    return null;
  }

  const user = userSnap.data() ?? {};
  const institutionId = typeof user.institutionId === 'string' ? user.institutionId : '';
  const instSnap = institutionId ? await db().doc(`institutions/${institutionId}`).get() : null;
  const issuer = issuerFromInstitution(instSnap?.data() as Record<string, unknown> | undefined);
  const studentName = certificateStudentName(user.name);
  const courseTitle = ((course.title as string) || '').trim() || 'Course';
  const level = certificateLevelName({
    level: typeof course.level === 'string' ? course.level : undefined,
    yearGroup: typeof course.yearGroup === 'string' ? course.yearGroup : undefined,
    programmeId: typeof course.programmeId === 'string' ? course.programmeId : undefined,
  });
  const keyRef = db().doc(`certificate_keys/${certificateKey(studentId, courseId, 'course')}`);
  const awarded = await db().runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) return null;
    const id = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const issuedByName = issuer.issuerName?.trim() || CERTIFICATE_ISSUER_NAME;
    const verifyUrl = `/verify/${id}`;
    const studentNumber = typeof user.studentNumber === 'string' ? user.studentNumber.trim() : '';
    tx.set(db().doc(`certificates/${id}`), {
      studentId,
      studentName,
      name: studentName,
      courseId,
      courseTitle,
      course: courseTitle,
      verifyUrl,
      qr: verifyUrl,
      ...(studentNumber ? { studentNumber } : {}),
      moduleId: 'course',
      moduleTitle: courseTitle,
      level,
      score: finalScore,
      passMark,
      issuedAt: FieldValue.serverTimestamp(),
      issuedBy: CERTIFICATE_ISSUER_ID,
      issuedByName,
      kind: 'course',
      brand: issuedByName,
      showPoweredBy: issuer.showPoweredBy !== false,
      ...(issuer.accent ? { accent: issuer.accent } : {}),
      ...(issuer.logoUrl ? { logoUrl: issuer.logoUrl } : {}),
      ...(issuer.certificateFooter ? { certificateFooter: issuer.certificateFooter } : {}),
      status: 'valid',
      disclaimer: 'Poket School certificates record a passed course final assessment. They are not official academic qualifications.',
    });
    tx.set(keyRef, {
      certificateId: id,
      studentId,
      courseId,
      moduleId: 'course',
      createdAt: FieldValue.serverTimestamp(),
    });
    const award: Omit<CourseCertificateResponse, 'absoluteVerifyUrl'> = {
      id,
      fresh: true,
      studentId,
      studentName,
      name: studentName,
      courseId,
      courseTitle,
      course: courseTitle,
      moduleId: 'course',
      moduleTitle: courseTitle,
      issuedAt,
      issuedByName,
      level,
      score: finalScore,
      verifyUrl,
      qr: verifyUrl,
      ...(studentNumber ? { studentNumber } : {}),
    };
    return award;
  });
  if (!awarded) return null;
  const response: CourseCertificateResponse = {
    ...awarded,
    absoluteVerifyUrl: absoluteVerifyUrl(awarded.verifyUrl),
  };
  try {
    await attachOpenBadge(response, { id: studentId, role: 'student' });
  } catch (error) {
    console.error('Certificate badge skipped', error);
  }
  let email = typeof user.email === 'string' ? user.email : '';
  if (!email.includes('@')) {
    try {
      email = (await adminAuth().getUser(studentId)).email ?? '';
    } catch {
      email = '';
    }
  }
  await emailCertificatePdfLink({
    to: email,
    studentName,
    courseTitle,
    certificateId: response.id,
  });
  return response;
}
