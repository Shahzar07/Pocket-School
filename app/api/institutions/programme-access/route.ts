import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import type { ProgrammeGrant } from '@/lib/institution-catalogue';

export const dynamic = 'force-dynamic';

function grantsFrom(value: unknown): ProgrammeGrant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const grant = row as Partial<ProgrammeGrant>;
    const itemId = typeof grant.itemId === 'string' ? grant.itemId.trim() : '';
    if (!itemId) return [];
    return [{
      itemId,
      studentIds: Array.isArray(grant.studentIds) ? grant.studentIds.filter((id): id is string => typeof id === 'string') : [],
      levels: Array.isArray(grant.levels) ? grant.levels.filter((level): level is string => typeof level === 'string') : [],
    }];
  });
}

async function canRead(uid: string, institutionId: string): Promise<boolean> {
  if (await callerIsAdmin(uid)) return true;
  const profile = await loadUser(uid);
  return profile?.institutionId === institutionId;
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ programmeIds: [], grants: [] });
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  if (!institutionId || !(await canRead(user.uid, institutionId))) {
    return NextResponse.json({ error: 'That academy is not on this account.' }, { status: 403 });
  }
  const [access, grantsSnap] = await Promise.all([
    adminDb().doc(`institutions/${institutionId}/settings/access`).get(),
    adminDb().doc(`institutions/${institutionId}/settings/programme_access`).get(),
  ]);
  const programmeIds = Array.isArray(access.get('programmeIds'))
    ? access.get('programmeIds').filter((id: unknown): id is string => typeof id === 'string')
    : [];
  return NextResponse.json({
    programmeIds,
    grants: grantsFrom(grantsSnap.get('grants')),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Programme assignment needs the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as { institutionId?: string; grants?: unknown };
  const institutionId = body.institutionId?.trim() ?? '';
  const profile = await loadUser(user.uid);
  const admin = await callerIsAdmin(user.uid, user.email, user);
  if (!institutionId || (!admin && profile?.institutionId !== institutionId)) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin to assign programmes.' }, { status: 403 });
  }
  const grants = grantsFrom(body.grants);
  await adminDb().doc(`institutions/${institutionId}/settings/programme_access`).set({ grants });
  return NextResponse.json({ grants });
}
