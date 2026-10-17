import 'server-only';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { callerIsAdmin, loadUser } from '@/lib/api-guard';
import { resolveStaffRole } from '@/lib/admin-console';
import { certificateStatus, type CertificateAward } from '@/lib/certificates';
import { recordActivity } from '@/lib/audit/server';
import {
  badgeStanding,
  badgeSvg,
  DEFAULT_TEMPLATE,
  expiryFrom,
  issuerOrigin,
  linkedInCertificationUrl,
  normaliseTemplate,
  PREVIEW_BADGE_ID,
  shareLinks,
  type BadgeStanding,
  type CertificateTemplate,
} from '@/lib/credentials/badge-model';
import { insertPngText, signedOpenBadge, verifyCredential } from '@/lib/credentials/open-badge';
import { loadBadgeSigner, verificationKeys } from '@/lib/server/badge-keys';

function issuedIso(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return fallback;
}

export async function loadTemplate(): Promise<CertificateTemplate> {
  if (!isAdminConfigured()) return DEFAULT_TEMPLATE;
  const snap = await adminDb().doc('certificate_templates/default').get();
  if (!snap.exists) return DEFAULT_TEMPLATE;
  return normaliseTemplate(snap.data() as Partial<CertificateTemplate>);
}

export async function saveTemplate(input: Partial<CertificateTemplate>, actor: { id: string; email: string; role: string }): Promise<CertificateTemplate> {
  const before = await loadTemplate();
  const next = normaliseTemplate({ ...before, ...input, id: 'default' });
  await adminDb().doc('certificate_templates/default').set({ ...next, updatedAt: Date.now(), updatedBy: actor.id });
  await recordActivity({
    action: 'settings.edit',
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetType: 'certificate_template',
    targetId: 'default',
    targetLabel: next.headline,
    before,
    after: next,
  });
  return next;
}

export async function issuerAccess(
  uid: string,
  email?: string,
  claims?: { role?: string | null; adminRole?: string | null },
): Promise<{
  actorRole: string;
  institutionId: string;
  admin: boolean;
  school: boolean;
} | null> {
  const profile = await loadUser(uid);
  const role = typeof profile?.role === 'string' ? profile.role : '';
  const staff = resolveStaffRole({
    email,
    role,
    adminRole: typeof profile?.adminRole === 'string' ? profile.adminRole : '',
  });
  if (claims?.role && claims.role !== 'admin' && claims.role !== 'institution_admin' && claims.role !== role) {
    return null;
  }
  const admin = (await callerIsAdmin(uid, email, claims)) || staff === 'super_admin' || staff === 'admin';
  const school = role === 'institution_admin';
  if (!admin && !school) return null;
  return {
    actorRole: staff || role || 'admin',
    institutionId: typeof profile?.institutionId === 'string' ? profile.institutionId : '',
    admin,
    school,
  };
}

export async function attachOpenBadge(
  award: CertificateAward,
  actor?: { id: string; email?: string; role?: string },
): Promise<void> {
  if (!isAdminConfigured()) return;
  try {
    const ref = adminDb().doc(`certificates/${award.id}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.openBadge) return;
    const template = await loadTemplate();
    const signer = await loadBadgeSigner();
    const origin = issuerOrigin();
    const expiresAt = expiryFrom(award.issuedAt, template.expiresInMonths);
    const openBadge = signedOpenBadge({
      id: award.id,
      studentName: award.studentName,
      studentId: award.studentId,
      courseId: award.courseId,
      courseTitle: award.courseTitle,
      moduleId: award.moduleId,
      moduleTitle: award.moduleTitle,
      issuedAt: award.issuedAt,
      origin,
      expiresAt,
      template,
    }, signer.privateKey, `${origin}/api/credentials/issuer#key-1`);
    await ref.set({ openBadge, expiresAt, templateId: template.id }, { merge: true });
    await recordActivity({
      action: 'certificate.issue',
      actorId: actor?.id || award.studentId,
      actorEmail: actor?.email || '',
      actorRole: actor?.role || 'student',
      device: 'server',
      targetType: 'certificate',
      targetId: award.id,
      targetLabel: award.moduleTitle,
      after: { courseId: award.courseId, moduleId: award.moduleId, expiresAt, studentId: award.studentId },
    });
  } catch (error) {
    console.error('[open-badge] credential was not attached', error);
  }
}

async function ensureBadge(id: string): Promise<FirebaseFirestore.DocumentSnapshot> {
  const ref = adminDb().doc(`certificates/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.openBadge) return snap;
  const data = snap.data() ?? {};
  const issuedAt = issuedIso(data.issuedAt, new Date().toISOString());
  await attachOpenBadge({
    id,
    fresh: false,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? 'Student'),
    courseId: String(data.courseId ?? ''),
    courseTitle: String(data.courseTitle ?? 'Course'),
    moduleId: String(data.moduleId ?? ''),
    moduleTitle: String(data.moduleTitle ?? data.courseTitle ?? 'Module'),
    issuedAt,
    issuedByName: String(data.issuedByName ?? 'Poket School'),
  });
  return ref.get();
}

export interface PublicCredential {
  id: string;
  legacy: boolean;
  signature: 'valid' | 'invalid' | 'missing';
  standing: BadgeStanding;
  expiresAt: string | null;
  revoked: boolean;
  reason: string;
  studentName: string;
  moduleTitle: string;
  courseTitle: string;
  credential: Record<string, unknown> | null;
  linkedInUrl: string;
  shares: ReturnType<typeof shareLinks>;
  imageUrl: string;
  issuerUrl: string;
  verifyUrl: string;
}

export async function publicCredential(id: string, origin: string, now = Date.now()): Promise<PublicCredential | null> {
  if (id === PREVIEW_BADGE_ID) {
    const base = issuerOrigin(origin);
    const verifyUrl = `${base}/preview/certificate`;
    const moduleTitle = 'Cells and organisation';
    const studentName = 'Aisha Rahman';
    const text = `${studentName} completed ${moduleTitle} on Poket School`;
    return {
      id,
      legacy: true,
      signature: 'missing',
      standing: 'unverified',
      expiresAt: null,
      revoked: false,
      reason: 'Preview only. This sample is not a signed record.',
      studentName,
      moduleTitle,
      courseTitle: 'Biology',
      credential: null,
      linkedInUrl: linkedInCertificationUrl({
        name: moduleTitle,
        organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
        issuedAt: '2026-10-15T12:00:00.000Z',
        certUrl: verifyUrl,
        certId: id,
      }),
      shares: shareLinks(verifyUrl, text),
      imageUrl: `${base}/api/credentials/${id}/image`,
      issuerUrl: `${base}/issuers/poket-school`,
      verifyUrl,
    };
  }
  if (!isAdminConfigured()) return null;
  const snap = await ensureBadge(id);
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const credential = data.openBadge && typeof data.openBadge === 'object' ? data.openBadge as Record<string, unknown> : null;
  let signature: PublicCredential['signature'] = credential ? 'invalid' : 'missing';
  if (credential) {
    try {
      const keys = await verificationKeys();
      signature = keys.some((key) => verifyCredential(credential, key)) ? 'valid' : 'invalid';
    } catch {
      signature = 'missing';
    }
  }
  const revoked = certificateStatus(data.status) === 'revoked';
  const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : null;
  const standing = badgeStanding({ signature, revoked, expiresAt, now });
  const base = issuerOrigin(origin);
  const verifyUrl = `${base}/verify/${encodeURIComponent(id)}`;
  const moduleTitle = String(data.moduleTitle ?? data.courseTitle ?? 'Module');
  const studentName = String(data.studentName ?? 'Student');
  const text = `${studentName} completed ${moduleTitle} on Poket School`;
  return {
    id,
    legacy: !credential,
    signature,
    standing,
    expiresAt,
    revoked,
    reason: typeof data.revocationReason === 'string' ? data.revocationReason : '',
    studentName,
    moduleTitle,
    courseTitle: String(data.courseTitle ?? ''),
    credential,
    linkedInUrl: linkedInCertificationUrl({
      name: moduleTitle,
      organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
      issuedAt: issuedIso(data.issuedAt, new Date(now).toISOString()),
      expiresAt,
      certUrl: verifyUrl,
      certId: id,
    }),
    shares: shareLinks(verifyUrl, text),
    imageUrl: `${base}/api/credentials/${id}/image`,
    issuerUrl: `${base}/issuers/poket-school`,
    verifyUrl,
  };
}

export async function issuerDocument(origin: string): Promise<Record<string, unknown>> {
  const base = issuerOrigin(origin);
  const id = `${base}/api/credentials/issuer`;
  let multibase = '';
  try {
    const signer = await loadBadgeSigner();
    multibase = signer.publicKeyMultibase;
  } catch {
    multibase = '';
  }
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id,
    type: ['Profile'],
    name: 'Poket School',
    url: base,
    email: 'hello@poketschool.ai',
    description: 'Poket School issues Open Badges 3.0 module certificates. They record that a student finished a module. They are not official academic qualifications.',
    verificationMethod: multibase ? [{
      id: `${id}#key-1`,
      type: 'Multikey',
      controller: id,
      publicKeyMultibase: multibase,
    }] : [],
  };
}

export async function renderBadgePng(svg: string, entries: { keyword: string; text: string }[]): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return Buffer.from(insertPngText(png, entries));
}

export async function badgeImage(id: string, origin: string): Promise<Buffer | null> {
  if (id === PREVIEW_BADGE_ID) {
    const svg = badgeSvg({
      studentName: 'Aisha Rahman',
      moduleTitle: 'Cells and organisation',
      courseTitle: 'Biology',
      issuerName: 'Poket School',
      standing: 'Preview',
      credentialId: id,
    });
    return renderBadgePng(svg, [
      { keyword: 'openbadges', text: `${issuerOrigin(origin)}/preview/certificate` },
      { keyword: 'openbadgecredential', text: JSON.stringify({ preview: true, id, issuer: 'Poket School' }) },
    ]);
  }
  const credential = await publicCredential(id, origin);
  if (!credential) return null;
  const svg = badgeSvg({
    studentName: credential.studentName,
    moduleTitle: credential.moduleTitle,
    courseTitle: credential.courseTitle,
    issuerName: 'Poket School',
    standing: credential.standing,
    credentialId: id,
  });
  return renderBadgePng(svg, [
    { keyword: 'openbadges', text: credential.verifyUrl },
    { keyword: 'openbadgecredential', text: JSON.stringify(credential.credential ?? { id, legacy: true }) },
  ]);
}

export async function credentialStatusDocument(id: string, origin: string) {
  const credential = await publicCredential(id, origin);
  if (!credential) return null;
  return {
    id: `${issuerOrigin(origin)}/api/credentials/${id}/status`,
    type: 'PoketCredentialStatus',
    status: credential.standing,
    revoked: credential.revoked,
    expiresAt: credential.expiresAt,
    reason: credential.reason,
  };
}

export async function bulkIssue(input: {
  callerId: string;
  callerEmail?: string;
  actorRole: string;
  institutionId: string;
  schoolOnly: boolean;
  courseId: string;
  moduleId: string;
  students: string[];
}): Promise<{ issued: { studentId: string; certificateId: string }[]; skipped: { studentId: string; reason: string }[] }> {
  const { syncModuleCertificates } = await import('@/lib/server/actions');
  const issued: { studentId: string; certificateId: string }[] = [];
  const skipped: { studentId: string; reason: string }[] = [];
  const tokens = [...new Set(input.students.map((item) => item.trim()).filter(Boolean))].slice(0, 100);
  for (const token of tokens) {
    const studentId = await resolveStudent(token);
    if (!studentId) {
      skipped.push({ studentId: token, reason: 'No matching student.' });
      continue;
    }
    if (input.schoolOnly) {
      const profile = await loadUser(studentId);
      if (profile?.institutionId !== input.institutionId) {
        skipped.push({ studentId: token, reason: 'That student is not in this school.' });
        continue;
      }
    }
    try {
      const result = await syncModuleCertificates(input.callerId, studentId, input.courseId);
      const match = result.issued.find((item) => !input.moduleId || item.moduleId === input.moduleId);
      if (!match) skipped.push({ studentId, reason: 'The module is not complete, or a certificate already exists.' });
      else issued.push({ studentId, certificateId: match.id });
    } catch (error) {
      skipped.push({ studentId, reason: error instanceof Error ? error.message : 'Could not issue.' });
    }
  }
  await recordActivity({
    action: 'certificate.bulk',
    actorId: input.callerId,
    actorEmail: input.callerEmail || '',
    actorRole: input.actorRole,
    device: 'server',
    targetType: 'course',
    targetId: input.courseId,
    targetLabel: input.moduleId,
    after: { issued: issued.length, skipped: skipped.length },
  });
  return { issued, skipped };
}

async function resolveStudent(token: string): Promise<string | null> {
  if (token.includes('@')) {
    const snap = await adminDb().collection('users').where('email', '==', token.toLowerCase()).limit(1).get();
    return snap.docs[0]?.id ?? null;
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(token)) return null;
  const snap = await adminDb().doc(`users/${token}`).get();
  return snap.exists ? token : null;
}
