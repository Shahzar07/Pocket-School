import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { courseCertificatePdf } from '@/lib/certificates/template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function issuedIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

/** Public PDF for a certificate id. The id is the verification key. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const certificateId = id.trim();
  if (!certificateId) return new NextResponse('Not found', { status: 404 });
  const snap = await adminDb().doc(`certificates/${certificateId}`).get();
  if (!snap.exists) return new NextResponse('Not found', { status: 404 });
  const data = snap.data() ?? {};
  if (data.status === 'revoked') return new NextResponse('Revoked', { status: 410 });
  const pdf = courseCertificatePdf({
    id: certificateId,
    studentName: text(data.studentName, 'Student'),
    courseTitle: text(data.courseTitle, 'Course'),
    level: text(data.level),
    issuedAt: issuedIso(data.issuedAt),
    score: typeof data.score === 'number' ? data.score : 0,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poket-school-${certificateId}.pdf"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
