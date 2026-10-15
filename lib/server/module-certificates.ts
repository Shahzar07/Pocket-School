import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import {
  CERTIFICATE_DISCLAIMER,
  CERTIFICATE_ISSUER_ID,
  CERTIFICATE_ISSUER_NAME,
  type CertificateAward,
  certificateKey,
  certificateStudentName,
  moduleIsComplete,
} from '../certificates';

interface IssueInput {
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  publishedIds: readonly string[];
  completedIds: readonly string[];
  fresh: boolean;
}

/**
 * Writes the certificate inside a transaction that has already read the key.
 * Returns null when the module is unfinished or a certificate already exists.
 */
export function issueInTransaction(
  tx: Transaction,
  firestore: Firestore,
  keyExists: boolean,
  input: IssueInput,
): CertificateAward | null {
  if (keyExists || !moduleIsComplete(input.publishedIds, input.completedIds)) return null;
  const id = crypto.randomUUID();
  const studentName = certificateStudentName(input.studentName);
  const issuedAt = new Date().toISOString();
  tx.set(firestore.doc(`certificates/${id}`), {
    studentId: input.studentId,
    studentName,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    moduleId: input.moduleId,
    moduleTitle: input.moduleTitle,
    issuedAt: FieldValue.serverTimestamp(),
    issuedBy: CERTIFICATE_ISSUER_ID,
    issuedByName: CERTIFICATE_ISSUER_NAME,
    kind: 'module',
    brand: 'Poket School',
    status: 'valid',
    disclaimer: CERTIFICATE_DISCLAIMER,
  });
  tx.set(firestore.doc(`certificate_keys/${certificateKey(input.studentId, input.courseId, input.moduleId)}`), {
    certificateId: id,
    studentId: input.studentId,
    courseId: input.courseId,
    moduleId: input.moduleId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    id,
    fresh: input.fresh,
    studentId: input.studentId,
    studentName,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    moduleId: input.moduleId,
    moduleTitle: input.moduleTitle,
    issuedAt,
    issuedByName: CERTIFICATE_ISSUER_NAME,
  };
}
