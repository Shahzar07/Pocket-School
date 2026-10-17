import { type Firestore, type Transaction } from 'firebase-admin/firestore';
import {
  CERTIFICATE_ISSUER_NAME,
  type CertificateAward,
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
  studentNumber?: string;
}

/**
 * Completion of published lessons does not award a certificate.
 * Course certificates are written only by lib/certificates/issue.ts, after the
 * final assessment and every unit are passed.
 */
export function issueInTransaction(
  tx: Transaction,
  firestore: Firestore,
  keyExists: boolean,
  input: IssueInput,
): CertificateAward | null {
  void tx;
  void firestore;
  void keyExists;
  void input;
  return null;
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
