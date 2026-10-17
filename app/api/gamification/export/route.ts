import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { badgeById } from '@/lib/gamification/card-svg';
import { exportAchievementBadge } from '@/lib/gamification/open-badge-export';
import { adminDb } from '@/lib/firebase-admin';
import { publicLabel } from '@/lib/platform/privacy-board';

/** Open Badges 3.0 export. Signs only when OPEN_BADGE_PRIVATE_KEY is set. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { limit: 20, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const id = req.nextUrl.searchParams.get('badge') ?? '';
  const badge = badgeById(id);
  if (!badge) return NextResponse.json({ error: 'Badge not found.', code: 'NOT_FOUND' }, { status: 404 });
  const state = await adminDb().doc(`gamification/${user.uid}`).get();
  const awarded = state.data()?.awarded;
  const earned = Array.isArray(awarded) && awarded.includes(id);
  const legacy = await adminDb().doc(`badges/${user.uid}_${id}`).get();
  if (!earned && !legacy.exists) {
    return NextResponse.json({ error: 'That badge has not been earned.', code: 'NOT_EARNED' }, { status: 404 });
  }
  const profile = await adminDb().doc(`users/${user.uid}`).get();
  const name = publicLabel(typeof profile.data()?.name === 'string' ? profile.data()?.name as string : '');
  const credential = exportAchievementBadge(
    badge,
    name,
    new Date().toISOString(),
    `${user.uid}-${id}`,
    process.env.OPEN_BADGE_PRIVATE_KEY,
  );
  return NextResponse.json({ credential, signed: Boolean(credential.proof) });
}
