import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { readApprovalSettings } from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Approval settings need the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const snap = await adminDb().doc('settings/institution_signup').get();
  const settings = readApprovalSettings(snap.exists ? snap.data() : undefined);
  const feedSnap = await adminDb().collection('institution_activations').orderBy('at', 'desc').limit(20).get();
  const feed = feedSnap.docs.map((row) => {
    const data = row.data();
    return {
      id: row.id,
      institutionId: typeof data.institutionId === 'string' ? data.institutionId : '',
      name: typeof data.name === 'string' ? data.name : '',
      at: typeof data.at === 'string' ? data.at : '',
      planId: typeof data.planId === 'string' ? data.planId : '',
      seats: typeof data.seats === 'number' ? data.seats : 0,
      total: typeof data.total === 'number' ? data.total : 0,
      currency: typeof data.currency === 'string' ? data.currency : '',
      tender: typeof data.tender === 'string' ? data.tender : '',
      trial: data.trial === true,
    };
  });
  return NextResponse.json({ settings, feed });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Approval settings need the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const settings = readApprovalSettings(body);
  await adminDb().doc('settings/institution_signup').set(settings);
  return NextResponse.json({ settings });
}
