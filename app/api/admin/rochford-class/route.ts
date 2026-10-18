import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { INSTITUTION_KEY_MESSAGE } from '@/lib/institutions/rochford';
import { seedRochfordClassIfMissing } from '@/lib/school-desk/seed-rochford';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, comingSoon: true, error: INSTITUTION_KEY_MESSAGE }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  try {
    const result = await seedRochfordClassIfMissing();
    return NextResponse.json({ ok: true, written: result.written, name: result.name });
  } catch (error) {
    console.error('Rochford class seed failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Could not seed that class.' }, { status: 500 });
  }
}
