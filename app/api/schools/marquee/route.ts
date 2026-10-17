import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { requestClient } from '@/lib/audit/model';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { publicSchoolStrip } from '@/lib/server/school-leads';

export const dynamic = 'force-dynamic';

/** Approved school names for the public homepage strip. Text only. */
export async function GET(req: NextRequest) {
  const ip = requestClient(req.headers).ip || 'unknown';
  if (!rateLimit(`school-strip:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  if (!isAdminConfigured()) return NextResponse.json({ names: [], minimum: 3 });
  const strip = await publicSchoolStrip();
  return NextResponse.json(strip);
}
