import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { mergeDefinitions, type BadgeDefinitionInput } from '@/lib/gamification/catalog';
import { definitionsFromConfig, sparksFromConfig } from '@/lib/gamification/engine';
import { adminDb } from '@/lib/firebase-admin';
import { assertSuperAdmin } from '@/lib/server/gamification';

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { limit: 30, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  try {
    await assertSuperAdmin(user.uid, user.email);
  } catch {
    return NextResponse.json({ error: 'Super admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const snap = await adminDb().doc('gamification_config/settings').get();
  return NextResponse.json({
    badges: definitionsFromConfig(snap.data()),
    sparks: sparksFromConfig(snap.data()),
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req, { limit: 20, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  try {
    await assertSuperAdmin(user.uid, user.email);
  } catch {
    return NextResponse.json({ error: 'Super admin access required.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { badges?: BadgeDefinitionInput[]; sparks?: { enabled?: boolean; amount?: number; badgeIds?: string[] } } | null;
  const badges = mergeDefinitions(body?.badges ?? []);
  const sparks = sparksFromConfig({ sparks: body?.sparks });
  await adminDb().doc('gamification_config/settings').set({
    badges,
    sparks,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  }, { merge: true });
  return NextResponse.json({ badges, sparks });
}
