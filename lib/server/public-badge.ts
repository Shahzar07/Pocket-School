import 'server-only';

import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { badgeById } from '@/lib/gamification/card-svg';
import { badgeIcon } from '@/lib/gamification/catalog';
import { publicLabel } from '@/lib/platform/privacy-board';

export interface PublicBadge {
  awardId: string;
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  earner: string;
  school: string;
  awardedAt: string | null;
}

const AWARD_ID = /^[A-Za-z0-9_-]{6,160}$/;

function awardedIso(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const seconds = (value as { seconds?: unknown; _seconds?: unknown }).seconds
    ?? (value as { _seconds?: unknown })._seconds;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return new Date(seconds * 1000).toISOString();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export async function loadPublicBadge(awardId: string): Promise<PublicBadge | null> {
  if (!AWARD_ID.test(awardId) || !isAdminConfigured()) return null;
  const snap = await adminDb().doc(`badges/${awardId}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const userId = typeof data.userId === 'string' ? data.userId : '';
  const user = userId ? await adminDb().doc(`users/${userId}`).get() : null;
  const userData = user?.data() ?? {};
  const badgeId = typeof data.type === 'string' ? data.type : '';
  const catalogue = badgeById(badgeId);
  const icon = badgeIcon(data) || catalogue?.icon || 'star';
  return {
    awardId,
    badgeId,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : catalogue?.name ?? 'Badge',
    description: typeof data.description === 'string' ? data.description : catalogue?.description ?? '',
    icon,
    tier: typeof data.tier === 'string' ? data.tier : catalogue?.tier ?? 'bronze',
    earner: publicLabel(typeof userData.name === 'string' ? userData.name : ''),
    school: typeof userData.schoolName === 'string' ? userData.schoolName : '',
    awardedAt: awardedIso(data.awardedAt),
  };
}
