import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { absoluteVerifyUrl, safeLogoUrl } from '@/lib/certificates';
import { loadCertificateAssets } from '@/lib/certificates/assets';
import { builtinDesigns, type CertificateDesign } from '@/lib/certificates/design';
import { certificatePdf } from '@/lib/certificates/pdf';
import { designForIssue } from '@/lib/certificates/sample-placeholders';
import { certificateDateLabel } from '@/lib/certificates/template';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { listDesigns } from '@/lib/server/certificate-designs';

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

async function bundledFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const dir = path.join(process.cwd(), 'public/fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'NotoSans-Regular.ttf')),
    readFile(path.join(dir, 'NotoSans-Bold.ttf')),
  ]);
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
}

/** The stored template, with preview art removed. A real academy logo on the certificate wins. */
async function issuedDesign(logoUrl: string): Promise<CertificateDesign> {
  const fallback = builtinDesigns()[0];
  if (!fallback) throw new Error('Missing certificate template');
  let base = fallback;
  if (isAdminConfigured()) {
    try {
      const designs = await listDesigns(null);
      base = designs.find((item) => item.isDefault) ?? designs[0] ?? fallback;
    } catch {
      base = fallback;
    }
  }
  const face = designForIssue(base);
  return logoUrl ? { ...face, logoUrl } : face;
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
  const issuedAt = issuedIso(data.issuedAt);
  const design = await issuedDesign(safeLogoUrl(text(data.logoUrl)) ?? '');
  const [fonts, assets] = await Promise.all([bundledFonts(), loadCertificateAssets(design)]);
  const pdf = await certificatePdf(design, {
    recipient: text(data.studentName, 'Student'),
    course: text(data.courseTitle) || text(data.level) || 'Course',
    date: certificateDateLabel(issuedAt),
    certificateId,
    verifyUrl: absoluteVerifyUrl(text(data.verifyUrl, `/verify/${certificateId}`)),
  }, { ...fonts, assets, labelledSample: false });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poket-school-${certificateId}.pdf"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
