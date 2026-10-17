import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { callerOwnsInstitution, startInstitutionTrial } from '@/lib/server/institution-activate';
import type { VolumePlanId } from '@/lib/institution-pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Institution checkout needs the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as {
    institutionId?: string;
    seats?: number;
    planId?: string;
    programmeIds?: string[];
  };
  const institutionId = body.institutionId?.trim() ?? '';
  if (!(await callerOwnsInstitution(user.uid, institutionId))) {
    return NextResponse.json({ error: 'Sign in as this academy’s admin to start a trial.' }, { status: 403 });
  }
  const planId: VolumePlanId = body.planId === 'primary_secondary' || body.planId === 'professional' || body.planId === 'igcse_alevel'
    ? body.planId
    : 'igcse_alevel';
  const programmeIds = Array.isArray(body.programmeIds) ? body.programmeIds.filter((item): item is string => typeof item === 'string') : [];
  try {
    const started = await startInstitutionTrial(institutionId, Number(body.seats), planId, programmeIds);
    return NextResponse.json(started);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start the trial.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
