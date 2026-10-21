import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { requestClient } from '@/lib/audit/model';
import { templateSampleRecord } from '@/lib/certificates/design';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { publicCertificate, type PublicCertificate } from '@/lib/server/student-pass';

export const dynamic = 'force-dynamic';

/** Anyone with a certificate link can read the student number, name, course and issue date. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ uuid: string }> }) {
  const ip = requestClient(req.headers).ip || 'unknown';
  if (!rateLimit(`verify-certificate:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many checks. Try again in a minute.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const { uuid } = await ctx.params;
  const sample = templateSampleRecord(uuid);
  const sampleBody: PublicCertificate | null = sample
    ? {
      studentNumber: '',
      studentName: sample.studentName,
      courseTitle: sample.courseTitle,
      moduleTitle: '',
      issuedAt: sample.issuedAt,
      status: 'valid',
      portfolioUrl: '',
      sample: true,
    }
    : null;
  if (!isAdminConfigured()) {
    if (sampleBody) return NextResponse.json(sampleBody);
    return NextResponse.json({ error: 'Verification is unavailable right now.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const record = await publicCertificate(uuid);
  if (!record) {
    if (sampleBody) return NextResponse.json(sampleBody);
    return NextResponse.json({ error: 'No matching certificate.', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(record);
}
