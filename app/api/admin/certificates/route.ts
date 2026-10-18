import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { CERTIFICATE_KEY_MESSAGE, CERTIFICATE_SAMPLE, normaliseDesign } from '@/lib/certificates/design';
import { certificatePdf } from '@/lib/certificates/pdf';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { listDesigns, saveDesign } from '@/lib/server/certificate-designs';
import { loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

function allowed(actor: { staff: string | null; role: string }): boolean {
  return actor.staff === 'super_admin' || actor.staff === 'admin' || actor.role === 'admin' || actor.role === 'institution_admin';
}

export async function GET(req: NextRequest) {
  const pdfId = req.nextUrl.searchParams.get('pdf');
  if (pdfId && !isAdminConfigured()) {
    const bytes = certificatePdf(normaliseDesign({ id: pdfId }), CERTIFICATE_SAMPLE);
    return new NextResponse(Buffer.from(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="poket-certificate.pdf"' },
    });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ designs: [], comingSoon: true, error: CERTIFICATE_KEY_MESSAGE });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!allowed(actor)) return NextResponse.json({ error: 'Certificates are hidden for this login.' }, { status: 403 });
  const scope = actor.staff === 'super_admin' ? null : actor.institutionId || '';
  if (pdfId) {
    const designs = await listDesigns(scope || null);
    const design = designs.find((item) => item.id === pdfId) ?? normaliseDesign({ id: pdfId });
    if (scope && design.institutionId && design.institutionId !== scope) {
      return NextResponse.json({ error: 'That template belongs to another institution.' }, { status: 403 });
    }
    const bytes = certificatePdf(design, CERTIFICATE_SAMPLE);
    return new NextResponse(Buffer.from(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${design.id}.pdf"` },
    });
  }
  const designs = await listDesigns(scope || null);
  return NextResponse.json({
    designs,
    canEditDefault: actor.staff === 'super_admin',
    institutionId: actor.institutionId,
    comingSoon: false,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, comingSoon: true, error: CERTIFICATE_KEY_MESSAGE }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!allowed(actor)) return NextResponse.json({ error: 'Certificates are hidden for this login.' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const design = normaliseDesign(body as Partial<import('@/lib/certificates/design').CertificateDesign>);
  if (actor.staff !== 'super_admin') {
    if (!actor.institutionId) return NextResponse.json({ error: 'This login has no institution.' }, { status: 403 });
    design.institutionId = actor.institutionId;
    design.isDefault = false;
    design.id = `institution-${actor.institutionId}`;
  }
  try {
    const saved = await saveDesign(design, actor.uid);
    return NextResponse.json({ ok: true, design: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save that template.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
