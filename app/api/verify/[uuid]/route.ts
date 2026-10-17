import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { requestClient } from '@/lib/audit/model';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { publicCertificate } from '@/lib/server/student-pass';

export const dynamic = 'force-dynamic';

/** Anyone with a certificate link can read the student number, name, course and issue date. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ uuid: string }> }) {
  const ip = requestClient(req.headers).ip || 'unknown';
  if (!rateLimit(`verify-certificate:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many checks. Try again in a minute.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Verification is unavailable right now.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const { uuid } = await ctx.params;
  const record = await publicCertificate(uuid);
  if (!record) {
    return NextResponse.json({ error: 'No matching certificate.', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(record);
}
