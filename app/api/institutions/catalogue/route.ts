import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { normalizeCatalogue, validateCatalogue } from '@/lib/institution-catalogue';
import { readApprovalSettings } from '@/lib/institution-self-serve';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminConfigured()) {
    return NextResponse.json({ catalogue: normalizeCatalogue(null) });
  }
  const snap = await adminDb().doc('institution_catalogue/current').get();
  return NextResponse.json({ catalogue: normalizeCatalogue(snap.exists ? snap.data() : null) });
}

export async function PUT(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Saving prices needs the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null);
  const catalogue = normalizeCatalogue(body);
  const problem = validateCatalogue(catalogue);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  await adminDb().doc('institution_catalogue/current').set(catalogue);
  const settingsSnap = await adminDb().doc('settings/institution_signup').get();
  const settings = readApprovalSettings(settingsSnap.exists ? settingsSnap.data() : undefined);
  await adminDb().doc('settings/institution_signup').set({
    ...settings,
    trialDays: catalogue.trialDays,
    trialSeatCap: catalogue.trialSeatCap,
  });
  return NextResponse.json({ catalogue });
}
