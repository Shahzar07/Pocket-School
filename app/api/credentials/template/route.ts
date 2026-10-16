import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { issuerAccess, loadTemplate, saveTemplate } from '@/lib/server/badge-issue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Certificate templates need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const access = await issuerAccess(user.uid, user.email, user);
  if (!access) return NextResponse.json({ error: 'School or platform admins can read the template.', code: 'FORBIDDEN' }, { status: 403 });
  return NextResponse.json({ template: await loadTemplate() });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Certificate templates need the server account.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const access = await issuerAccess(user.uid, user.email, user);
  if (!access?.admin) return NextResponse.json({ error: 'Platform admins design the certificate.', code: 'FORBIDDEN' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const template = await saveTemplate({
    headline: typeof body.headline === 'string' ? body.headline : undefined,
    narrative: typeof body.narrative === 'string' ? body.narrative : undefined,
    accent: typeof body.accent === 'string' ? body.accent : undefined,
    issuerName: typeof body.issuerName === 'string' ? body.issuerName : undefined,
    expiresInMonths: body.expiresInMonths === null ? null : Number(body.expiresInMonths) || null,
  }, { id: user.uid, email: user.email || '', role: access.actorRole });
  return NextResponse.json({ template });
}
