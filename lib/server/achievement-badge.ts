import 'server-only';

import { publicName } from '@/lib/alumni';
import { linkedInCertificationUrl, shareLinks, badgeSvg } from '@/lib/credentials/badge-model';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { renderBadgePng } from '@/lib/server/badge-issue';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function issuedIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate: () => Date }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate.call(value);
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return '2020-01-01T00:00:00.000Z';
}

export function isBadgeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{3,96}$/.test(id);
}

export async function publicAchievementBadge(id: string, origin: string): Promise<{
  id: string;
  name: string;
  learner: string;
  studentNumber: string;
  issuedAt: string;
  verifyUrl: string;
  linkedInUrl: string;
  shares: ReturnType<typeof shareLinks>;
} | null> {
  if (!isBadgeId(id) || !isAdminConfigured()) return null;
  const snap = await adminDb().doc(`badges/${id}`).get();
  if (!snap.exists) return null;
  const badgeName = text(snap.get('name')).trim() || 'Badge';
  const issuedAt = issuedIso(snap.get('awardedAt'));
  const userId = text(snap.get('userId'));
  const user = userId ? await adminDb().doc(`users/${userId}`).get() : null;
  const base = origin.replace(/\/$/, '');
  const verifyUrl = `${base}/verify/badge/${encodeURIComponent(id)}`;
  return {
    id,
    name: badgeName,
    learner: publicName(text(user?.get('name'))),
    studentNumber: text(user?.get('studentNumber')).trim().toUpperCase(),
    issuedAt,
    verifyUrl,
    linkedInUrl: linkedInCertificationUrl({
      name: badgeName,
      organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
      issuedAt,
      certUrl: verifyUrl,
      certId: id,
    }),
    shares: shareLinks(verifyUrl, `${badgeName} on Poket School`),
  };
}

export async function achievementBadgePng(id: string, origin: string): Promise<Buffer | null> {
  const badge = await publicAchievementBadge(id, origin);
  if (!badge) return null;
  const svg = badgeSvg({
    studentName: badge.learner || 'Learner',
    moduleTitle: badge.name,
    courseTitle: 'Poket School badge',
    issuerName: 'Poket School',
    standing: 'valid',
    accent: '#1A3C34',
    credentialId: badge.id,
  });
  return renderBadgePng(svg, [{ keyword: 'openbadges', text: badge.verifyUrl }]);
}
