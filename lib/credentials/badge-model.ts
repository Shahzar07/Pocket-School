/**
 * Open Badges 3.0 credential body. Signing lives in open-badge.ts so a
 * browser bundle never imports Node crypto.
 */

import { CERTIFICATE_DISCLAIMER, CERTIFICATE_ISSUER_ID, CERTIFICATE_ISSUER_NAME } from '@/lib/certificates';

export const BADGE_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
  'https://w3id.org/security/data-integrity/v2',
];

export const ISSUER_SLUG = CERTIFICATE_ISSUER_ID;
export const PREVIEW_BADGE_ID = '11111111-2222-4333-8444-555555555555';

export interface CertificateTemplate {
  id: string;
  headline: string;
  narrative: string;
  accent: string;
  expiresInMonths: number | null;
  issuerName: string;
}

export const DEFAULT_TEMPLATE: CertificateTemplate = {
  id: 'default',
  headline: 'Certificate of Achievement',
  narrative: 'Completed every published lesson in this module on Poket School. This record is not an official academic qualification.',
  accent: '#1E6A83',
  expiresInMonths: null,
  issuerName: CERTIFICATE_ISSUER_NAME,
};

export interface BadgeSource {
  id: string;
  studentName: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  issuedAt: string;
  origin: string;
  expiresAt: string | null;
  template: CertificateTemplate;
  /** Partner endorsement. The issuer stays Poket School. */
  endorsement?: { name: string; logoUrl?: string; comment: string } | null;
}

export function issuerOrigin(origin?: string): string {
  const value = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://poketschool.ai').replace(/\/$/, '');
  return value;
}

export function normaliseIssuerName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed || /^pocket school$/i.test(trimmed)) return CERTIFICATE_ISSUER_NAME;
  return trimmed.slice(0, 80);
}

export function normaliseTemplate(input: Partial<CertificateTemplate> | null | undefined): CertificateTemplate {
  const accent = typeof input?.accent === 'string' && /^#([0-9a-fA-F]{6})$/.test(input.accent) ? input.accent : DEFAULT_TEMPLATE.accent;
  const rawMonths = input?.expiresInMonths;
  const months = typeof rawMonths === 'number' && Number.isFinite(rawMonths) && rawMonths >= 1
    ? Math.min(120, Math.round(rawMonths))
    : null;
  return {
    id: 'default',
    headline: (input?.headline || DEFAULT_TEMPLATE.headline).replace(/\s+/g, ' ').trim().slice(0, 80) || DEFAULT_TEMPLATE.headline,
    narrative: (input?.narrative || DEFAULT_TEMPLATE.narrative).trim().slice(0, 400) || DEFAULT_TEMPLATE.narrative,
    accent,
    expiresInMonths: months,
    issuerName: normaliseIssuerName(input?.issuerName || DEFAULT_TEMPLATE.issuerName),
  };
}

export function expiryFrom(issuedAt: string, months: number | null): string | null {
  if (!months || months < 1) return null;
  const date = new Date(issuedAt);
  if (Number.isNaN(date.getTime())) return null;
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

export function buildOpenBadge(source: BadgeSource & { identityHash?: string }): Record<string, unknown> {
  const origin = issuerOrigin(source.origin);
  const moduleTitle = source.moduleTitle.trim() || source.courseTitle;
  const credential: Record<string, unknown> = {
    '@context': BADGE_CONTEXT,
    id: `${origin}/api/credentials/${source.id}`,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: `${origin}/api/credentials/issuer`,
      type: ['Profile'],
      name: source.template.issuerName,
      url: origin,
      email: 'hello@poketschool.ai',
    },
    validFrom: source.issuedAt,
    name: `${source.template.headline}: ${moduleTitle}`,
    credentialSubject: {
      type: ['AchievementSubject'],
      identifier: [{
        type: 'IdentityObject',
        identityHash: source.identityHash || 'sha256$unavailable',
        identityType: 'identifier',
        hashed: true,
        salt: source.id.slice(0, 8),
      }],
      achievement: {
        id: `${origin}/achievements/${encodeURIComponent(source.courseId)}/${encodeURIComponent(source.moduleId)}`,
        type: ['Achievement'],
        name: moduleTitle,
        description: `${moduleTitle} in ${source.courseTitle}. ${CERTIFICATE_DISCLAIMER}`,
        criteria: { narrative: source.template.narrative },
        achievementType: 'Achievement',
        ...(source.endorsement?.name ? {
          endorsement: [{
            type: ['EndorsementSubject'],
            comment: source.endorsement.comment || `Recognised by ${source.endorsement.name}`,
            issuer: {
              type: ['Profile'],
              name: source.endorsement.name,
              ...(source.endorsement.logoUrl ? { image: source.endorsement.logoUrl } : {}),
            },
          }],
        } : {}),
        image: {
          id: `${origin}/api/credentials/${source.id}/image`,
          type: 'Image',
        },
      },
    },
    credentialStatus: {
      id: `${origin}/api/credentials/${source.id}/status`,
      type: 'PoketCredentialStatus',
    },
  };
  if (source.expiresAt) credential.validUntil = source.expiresAt;
  return credential;
}

export type BadgeStanding = 'valid' | 'revoked' | 'expired' | 'unverified';

export function badgeStanding(input: {
  signature: 'valid' | 'invalid' | 'missing';
  revoked: boolean;
  expiresAt: string | null;
  now: number;
}): BadgeStanding {
  if (input.signature !== 'valid') return 'unverified';
  if (input.revoked) return 'revoked';
  if (input.expiresAt) {
    const expires = Date.parse(input.expiresAt);
    if (!Number.isNaN(expires) && expires <= input.now) return 'expired';
  }
  return 'valid';
}

export function linkedInCertificationUrl(input: {
  name: string;
  organizationName?: string;
  issuedAt: string;
  expiresAt?: string | null;
  certUrl: string;
  certId: string;
}): string {
  const issued = new Date(input.issuedAt);
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: input.name,
    organizationName: input.organizationName || CERTIFICATE_ISSUER_NAME,
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: input.certUrl,
    certId: input.certId,
  });
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt);
    if (!Number.isNaN(expires.getTime())) {
      params.set('expirationYear', String(expires.getUTCFullYear()));
      params.set('expirationMonth', String(expires.getUTCMonth() + 1));
    }
  }
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function shareLinks(url: string, text: string): { copy: string; linkedin: string; whatsapp: string; email: string } {
  return {
    copy: url,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${url}`)}`,
  };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function badgeSvg(input: {
  studentName: string;
  moduleTitle: string;
  courseTitle: string;
  issuerName: string;
  standing: string;
  accent?: string;
  credentialId: string;
}): string {
  const accent = input.accent && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : '#1E6A83';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="#F4F7F8"/>
  <circle cx="400" cy="360" r="280" fill="${accent}"/>
  <circle cx="400" cy="360" r="248" fill="#ffffff"/>
  <text x="400" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${accent}" letter-spacing="4">POKET SCHOOL</text>
  <text x="400" y="320" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#1c2b30">${escapeXml(input.moduleTitle.slice(0, 42))}</text>
  <text x="400" y="380" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#526066">${escapeXml(input.courseTitle.slice(0, 48))}</text>
  <text x="400" y="450" text-anchor="middle" font-family="Georgia, serif" font-size="32" font-style="italic" fill="${accent}">${escapeXml(input.studentName.slice(0, 40))}</text>
  <text x="400" y="510" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#526066">${escapeXml(input.issuerName)} · ${escapeXml(input.standing)}</text>
  <text x="400" y="700" text-anchor="middle" font-family="ui-monospace, monospace" font-size="14" fill="#526066">${escapeXml(input.credentialId)}</text>
</svg>`;
}
