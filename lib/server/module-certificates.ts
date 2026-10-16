import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import {
  CERTIFICATE_DISCLAIMER,
  CERTIFICATE_ISSUER_ID,
  CERTIFICATE_ISSUER_NAME,
  type CertificateAward,
  certificateKey,
  certificateStudentName,
  moduleIsComplete,
  safeLogoUrl,
} from '../certificates';
import { certificateBrandLine } from '../oem';

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
  issuerName?: string;
  showPoweredBy?: boolean;
  accent?: string;
  logoUrl?: string;
  certificateFooter?: string;
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
  const issuedByName = input.issuerName?.trim() || CERTIFICATE_ISSUER_NAME;
  tx.set(firestore.doc(`certificates/${id}`), {
    studentId: input.studentId,
    studentName,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    moduleId: input.moduleId,
    moduleTitle: input.moduleTitle,
    issuedAt: FieldValue.serverTimestamp(),
    issuedBy: CERTIFICATE_ISSUER_ID,
    issuedByName,
    kind: 'module',
    brand: issuedByName,
    showPoweredBy: input.showPoweredBy !== false,
    ...(input.accent ? { accent: input.accent } : {}),
    ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
    ...(input.certificateFooter ? { certificateFooter: input.certificateFooter } : {}),
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
    issuedByName,
  };
}

export function issuerFromInstitution(data: Record<string, unknown> | undefined): {
  issuerName: string;
  showPoweredBy: boolean;
  accent?: string;
  logoUrl?: string;
  certificateFooter?: string;
} {
  if (!data) return { issuerName: CERTIFICATE_ISSUER_NAME, showPoweredBy: true };
  const branding = data.branding && typeof data.branding === 'object'
    ? data.branding as {
      displayName?: string;
      certificateIssuer?: string;
      hidePoweredBy?: boolean;
      primaryColor?: string;
      logoUrl?: string;
      certificateFooter?: string;
    }
    : {};
  const name = typeof data.name === 'string' ? data.name : '';
  const accent = typeof branding.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  const logoUrl = safeLogoUrl(branding.logoUrl) ?? undefined;
  const certificateFooter = typeof branding.certificateFooter === 'string' ? branding.certificateFooter.trim().slice(0, 240) : '';
  return {
    issuerName: certificateBrandLine({
      displayName: branding.displayName || name || CERTIFICATE_ISSUER_NAME,
      certificateIssuer: branding.certificateIssuer,
    }),
    showPoweredBy: branding.hidePoweredBy !== true,
    accent,
    ...(logoUrl ? { logoUrl } : {}),
    ...(certificateFooter ? { certificateFooter } : {}),
  };
}
