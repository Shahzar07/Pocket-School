import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { loadCertificateAssets } from '@/lib/certificates/assets';
import { CERTIFICATE_KEY_MESSAGE, CERTIFICATE_SAMPLE, isBuiltinTemplate, normaliseDesign, scopeDesignForActor, type CertificateDesign } from '@/lib/certificates/design';
import { certificatePdf } from '@/lib/certificates/pdf';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { deleteDesign, listDesigns, saveDesign } from '@/lib/server/certificate-designs';
import { loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

function allowed(actor: { staff: string | null; role: string }): boolean {
  return actor.staff === 'super_admin' || actor.staff === 'admin' || actor.role === 'admin' || actor.role === 'institution_admin';
}

async function bundledFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const dir = path.join(process.cwd(), 'public/fonts');
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, 'NotoSans-Regular.ttf')),
    readFile(path.join(dir, 'NotoSans-Bold.ttf')),
  ]);
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
}

async function pdfResponse(design: CertificateDesign, filename: string) {
  const [fonts, assets] = await Promise.all([bundledFonts(), loadCertificateAssets(design)]);
  const bytes = await certificatePdf(design, CERTIFICATE_SAMPLE, { ...fonts, assets });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const pdfId = req.nextUrl.searchParams.get('pdf');
  if (pdfId && !isAdminConfigured()) {
    return pdfResponse(normaliseDesign({ id: pdfId }), 'poket-certificate.pdf');
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
    return pdfResponse(design, `${design.id}.pdf`);
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
  let design = normaliseDesign(body as Partial<CertificateDesign>);
  if (actor.staff !== 'super_admin') {
    if (!actor.institutionId) return NextResponse.json({ error: 'This login has no institution.' }, { status: 403 });
    design = scopeDesignForActor(design, actor);
  }
  try {
    const saved = await saveDesign(design, actor.uid);
    return NextResponse.json({ ok: true, design: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save that template.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, comingSoon: true, error: CERTIFICATE_KEY_MESSAGE }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!allowed(actor)) return NextResponse.json({ error: 'Certificates are hidden for this login.' }, { status: 403 });
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Name the template.' }, { status: 400 });
  if (isBuiltinTemplate(id)) {
    return NextResponse.json({ error: 'The Poket templates stay on the page. Duplicate one to make your own.' }, { status: 400 });
  }
  if (actor.staff !== 'super_admin' && id !== `institution-${actor.institutionId}`) {
    return NextResponse.json({ error: 'That template belongs to another institution.' }, { status: 403 });
  }
  await deleteDesign(id);
  return NextResponse.json({ ok: true });
}
